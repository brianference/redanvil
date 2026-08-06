/** Protocol-relative //evil.example must still fail the rule. */
export function ProtocolRelative({ value }: { value: string }): JSX.Element {
  // value may be '//evil.example'
  return <a href={value}>go</a>;
}
