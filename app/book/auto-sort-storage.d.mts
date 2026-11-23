import type {Budget} from './model.mjs';
import type {Library} from './library-model.mjs';
export function saveAutoSortRules(storage:Pick<Storage,'getItem'|'setItem'>,projectId:string,change:(budget:Budget)=>Budget):Library;
