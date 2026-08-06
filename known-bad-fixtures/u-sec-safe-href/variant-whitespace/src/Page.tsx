/** Leading whitespace before javascript: must still fail the rule (data-driven href). */
export function Whitespace({ value }: { value: string }): JSX.Element {
  // value may be ' javascript:alert(1)'
  return <a href={value}>go</a>;
}
