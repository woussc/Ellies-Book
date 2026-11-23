import {activeBudget,changeLibrary} from './library-model.mjs';
import {saveStatement} from './statement-storage.mjs';
export function saveAutoSortRules(storage, projectId, change) {
  return saveStatement(storage, library => {
    const project=activeBudget(library);
    if(!project||project.id!==projectId)throw new Error('The open project changed in another tab. Reopen it before changing rules.');
    return changeLibrary(library,{type:'update',project:change(project)});
  },{conflict:'Your book changed in another tab. Review the rule again.',write:'The rule was not saved. Your entry is still saved. Free device storage, then try again.'});
}
