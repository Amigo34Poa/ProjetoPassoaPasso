export const ROLES = ['SDR', 'Assistente', 'Vendedor Interno', 'Supervisor Interno de Vendas', 'Gerente de Vendas', 'Pós-Vendas'] as const;
export type Role = typeof ROLES[number];
export type Provider = 'browser' | 'windows' | 'gemini' | 'openai';
export type Annotation = { id: string; type: 'highlight'|'circle'|'arrow'|'box'|'blur'|'label'; x: number; y: number; x2: number; y2: number; text: string };
export type Step = { id: string; title: string; transcript: string; instruction: string; time: number; endTime: number; imageId?: string; annotations: Annotation[]; source: 'manual'|'click'|'automatic'|'demo'; window?: string; clipId?: string; clipFormat?: 'video'|'gif'; clipStart?: number; clipEnd?: number; transcriptIds?: string[]; action?: { button:'left'|'right'; x:number; y:number }; draftOrigin?:'local-rules' };
export type Transcript = { id: string; text: string; time: number; endTime: number; source: string; stepId?:string|null };
export type Playbook = {
  id: string; title: string; description: string; role: Role; status: 'draft'|'published'|'recording'|'interrupted';
  createdAt: string; updatedAt: string; duration: number; steps: Step[]; transcript: Transcript[];
  version: number; audioId?: string; videoId?: string; recordingSource?: 'browser'|'windows';
  audioChunks?: string[]; videoChunks?: string[]; driveId?: string; driveSyncedAt?: string; demo?: boolean;
};
export type Asset = { id: string; bookId: string; blob: Blob; kind: 'image'|'audio'|'video'|'chunk'; createdAt: number };
export type Display = { id: number; name: string; width: number; height: number; primary: boolean; x: number; y: number };
export type Config = { provider: Provider; configured: boolean; consent: boolean; model: string; liveModel: string; googleClientId: string; portable?: boolean; native: { available: boolean; reason: string; displays: Display[]; speechLanguages: string[]; platform?:string; mouseHook?:boolean; hotkeys?:Record<string,boolean> } };
export const id = () => crypto.randomUUID();
export function formatTime(seconds: number) { const n = Math.max(0,Math.floor(seconds)); return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`; }
export function createBook(title: string, role: Role): Playbook {
  const now = new Date().toISOString();
  return { id:id(),title:title.trim() || 'Novo procedimento',description:'',role,status:'draft',createdAt:now,updatedAt:now,duration:0,steps:[],transcript:[],version:1 };
}
