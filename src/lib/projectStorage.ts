import * as native from './nativeProject';
import { browserStorage } from './browserProject';
export type ProjectStorage = Pick<typeof native, 'pickMedia' | 'loadMedia' | 'pickProject' | 'writeProject' | 'chooseProjectPath' | 'readRecovery' | 'writeRecovery' | 'clearRecovery'> & { downloadProject?: (path: string, text: string) => void; readMedia?: typeof native.readMedia; resolveSource?: typeof native.resolveSource };
declare global { interface Window { __UNSAID_STORAGE__?: ProjectStorage } }
export const storage: ProjectStorage = window.__UNSAID_STORAGE__ ?? (native.isDesktop ? native : browserStorage);
export const desktop = !!window.__UNSAID_STORAGE__ || native.isDesktop;
export const nativeListeners = native.isDesktop;

export const browserMode = !window.__UNSAID_STORAGE__ && !native.isDesktop;
