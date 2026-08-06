/**
 * Fixture with no data-driven href — must pass / not false-fail.
 */
export function Home(): JSX.Element {
  return (
    <main>
      <h1>Hello</h1>
      <a href="/about">About</a>
    </main>
  );
}
