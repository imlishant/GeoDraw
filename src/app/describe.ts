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

/** Plain-text write-up of the solution: numbered steps and totals. */
export function stepsAsText(doc: Doc): string {
  const lines = [`${doc.title}`, ''];
  const givens = doc.order.filter((id) => doc.objects[id]?.given).map((id) => doc.objects[id].name);
  if (givens.length) lines.push(`Given: ${givens.join(', ')}`, '');
  doc.steps.forEach((s, i) => {
    lines.push(`${i + 1}. ${describeStep(doc, s)}${s.note ? `\n   ${s.note}` : ''}`);
  });
  return lines.join('\n');
}
