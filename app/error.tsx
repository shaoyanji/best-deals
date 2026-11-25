"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-page">
      <h1>A little hiccup.</h1>
      <p>We couldn’t load the deals right now.</p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
