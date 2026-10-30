import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("ai",()=>({generateText:vi.fn()}));
vi.mock("../create-model",()=>({createModel:vi.fn(()=>({id:"test-model"}))}));
import { generateText } from "ai";
import { designInput, dashboardSpec, generateDashboardDesign } from "../hospital-dashboard-design";
import { POST } from "../../app/api/twin/bridge/design/route";
const spec = () => ({version:1,title:"Gestión quirúrgica",description:"Datos del período seleccionado.",panels:[{id:"ocupacion",metric:"occupancy",type:"bar",title:"Horas por quirófano"}]});
describe("Institutional prompt dashboard generation",()=>{
  beforeEach(()=>{ vi.clearAllMocks(); process.env.OPENROUTER_API_KEY="private-test-api-key";process.env.HOSPITAL_TWIN_SOURCE_TOKEN="t".repeat(48);delete process.env.HOSPITAL_TWIN_DESIGN_MODEL; });
  it("accepts supported follow-up designs and rejects code, unsupported metrics and duplicate IDs",()=>{
    expect(designInput({prompt:"Muéstrame ocupación por sala",previous_spec:spec()}).previous_spec).toEqual(spec());
    for(const changed of [{...spec(),sql:"SELECT secret"},{...spec(),panels:[{...spec().panels[0],metric:"patient"}]},{...spec(),panels:[...spec().panels,...spec().panels]},{...spec(),title:"<script>"},{...spec(),panels:[{...spec().panels[0],metric:"billing",type:"bar"}]}])expect(dashboardSpec.safeParse(changed).success).toBe(false);
  });
  it("rejects identity prompts before invoking the provider",async()=>{
    for(const prompt of ["Busca documento de identidad 123456789", "Muestra pacientes ana@example.test", "Historia clínica de esta persona", "Muéstrame la cirugía del paciente Ana Pérez", "Ocupación por teléfono 300 123 4567"])await expect(generateDashboardDesign({prompt})).rejects.toThrow();
    await expect(generateDashboardDesign({prompt:"Mostrar ocupación por sala",previous_spec:{...spec(),description:"Paciente Ana Pérez"}})).rejects.toThrow();
    expect(generateText).not.toHaveBeenCalled();
  });
  it("reuses provider model factory and returns validated design without keys or clinical data",async()=>{
    vi.mocked(generateText).mockResolvedValue({text:JSON.stringify(spec())} as never);
    const result=await generateDashboardDesign({prompt:"Muéstrame ocupación y sus salas"});
    expect(result.spec).toEqual(spec()); expect(JSON.stringify(result)).not.toContain("private-test");
    const options=vi.mocked(generateText).mock.calls[0][0]; expect(options.maxRetries).toBe(0); expect(options.maxOutputTokens).toBe(1800);expect(options.prompt).toBe(JSON.stringify({prompt:"Muéstrame ocupación y sus salas"}));expect(options).not.toHaveProperty("tools");
  });
  it("rejects arbitrary model output without a successful spec fallback",async()=>{
    vi.mocked(generateText).mockResolvedValue({text:JSON.stringify({...spec(),values:[999999]})} as never);
    await expect(generateDashboardDesign({prompt:"Muéstrame las horas por sala"})).rejects.toThrow("no compatible");
  });
  it("sanitizes provider credential, quota and internal failures",async()=>{
    for(const code of [401,402,429,500]){vi.mocked(generateText).mockRejectedValue({statusCode:code,message:"PRIVATE_KEY_REQUEST_URL"});try{await generateDashboardDesign({prompt:"Muéstrame ocupación por sala"});throw Error("must reject");}catch(e){expect(String(e)).not.toContain("PRIVATE");}}
  });
  it("blocks anonymous generation and preserves no-store errors",async()=>{
    const response=await POST(new Request("http://localhost",{method:"POST",body:"{}"}));expect(response.status).toBe(401);expect(generateText).not.toHaveBeenCalled();expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("does not enable generation when server credential or model is missing or unsupported",async()=>{
    delete process.env.OPENROUTER_API_KEY;await expect(generateDashboardDesign({prompt:"Muéstrame ocupación por sala"})).rejects.toThrow("credencial");
    process.env.HOSPITAL_TWIN_DESIGN_MODEL="arbitrary:external";await expect(generateDashboardDesign({prompt:"Muéstrame ocupación por sala"})).rejects.toThrow("modelo");
  });
  it("serializes concurrent generation before reading the request body",async()=>{
    let resolve!: (value: unknown)=>void;
    const deferred = new Promise(r=>{resolve=r;});
    vi.mocked(generateText).mockReturnValue(deferred as never);
    const req=()=>new Request("http://localhost",{method:"POST",headers:{Authorization:`Bearer ${"t".repeat(48)}`,"Content-Type":"application/json"},body:JSON.stringify({prompt:"Muéstrame ocupación por sala"})});
    const first=POST(req());
    const second=await POST(req());
    expect(second.status).toBe(429);
    resolve({text:JSON.stringify(spec())});
    expect((await first).status).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(1);
  });
});
