/** Embedded tab/newline inside the scheme must still fail the rule. */
export function TabScheme({ value }: { value: string }): JSX.Element {
  // value may be 'java\tscript:alert(1)' or 'java\nscript:alert(1)'
  return <a href={value}>go</a>;
}
