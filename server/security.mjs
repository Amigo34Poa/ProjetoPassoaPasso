import { randomBytes } from 'node:crypto';

export function validOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

export function sessionStore() {
  const sessions = new Map();
  return {
    get(req, res) {
      const id = /(?:^|;\s*)playbook_session=([a-f0-9]{48})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      let session = id && sessions.get(id);
      if (!session) {
        if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
        session = { id: randomBytes(24).toString('hex'), apiKeys: { gemini: '', openai: '' }, provider: 'browser', consent: false };
        sessions.set(session.id, session);
        res?.cookie('playbook_session', session.id, { httpOnly: true, sameSite: 'strict', path: '/' });
      }
      session.updated = Date.now();
      return session;
    },
    fromCookie(req) {
      const id = /(?:^|;\s*)playbook_session=([a-f0-9]{48})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      return id ? sessions.get(id) : undefined;
    },
  };
}

export function publicError(error) {
  const status = Number(error?.status || error?.statusCode);
  if (status === 401 || status === 403) return 'A API recusou a credencial ou o acesso ao modelo. Verifique a chave e as permissões do projeto.';
  if (status === 429) return 'A cota da API foi atingida. Verifique limites e faturamento; sua gravação local continua preservada.';
  if (status === 404) return 'Modelo indisponível para este projeto. Escolha um modelo habilitado nas configurações.';
  return 'Não foi possível concluir a solicitação à IA. Verifique a conexão, a chave e o modelo configurado.';
}
