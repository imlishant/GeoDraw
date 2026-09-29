import type { Doc, Step } from '../engine/types';
import { TOOL_BY_KEY } from './tools';

const nameOf = (doc: Doc, id: string) => doc.objects[id]?.name ?? '?';

/** "Circle (A, B) → a" */
export function describeStep(doc: Doc, s: Step): string {
  const label = TOOL_BY_KEY[s.tool]?.label ?? s.tool;
  const inputs = s.inputs.map((i) => nameOf(doc, i));
  const outs = s.outputs.filter((o) => !s.inputs.includes(o)).map((o) => nameOf(doc, o));
  const ins = inputs.length ? ` (${inputs.join(', ')})` : '';
  return `${label}${ins}${outs.length ? ` → ${outs.join(', ')}` : ''}`;
}
