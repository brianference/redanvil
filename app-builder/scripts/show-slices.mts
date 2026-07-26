/** Print the build plan slices for a prompt, to check they follow the features. */
import { generatePrd } from '../src/lib/prd';
import { estimate } from '../src/lib/estimate';
import { EMPTY_WIZARD_ANSWERS } from '../src/lib/job';
const prd = generatePrd(
  {
    ...EMPTY_WIZARD_ANSWERS,
    prompt: process.argv[2] ?? '',
    appType: 'Mobile app',
    hasAuth: false,
    entities: process.argv[3] ?? ''
  },
  estimate({ features: 4, hasAuth: false, entities: 2, scopeSignals: 2 })
);
const start = prd.markdown.indexOf('## 11. Build Plan');
const end = prd.markdown.indexOf('## 12.');
console.log(prd.markdown.slice(start, end).split('\n').filter((l) => /^### Slice|^- DB:|^- API:/.test(l)).join('\n'));
