import "./App.css";

function App() {
  return (
    <main className="min-h-screen bg-bg text-text p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-4xl font-bold">Pokédex</h1>
        <p className="mt-2 text-muted">Discover and explore Pokémon.</p>
      </header>

      <section className="max-w-sm rounded-2xl bg-bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-muted">#0004</span>
          <div className="flex gap-2">
            <span className="rounded-full bg-type-fire px-3 py-1 text-sm font-semibold text-white">
              Fire
            </span>
          </div>
        </div>

        <h2 className="text-2xl font-semibold">Charmander</h2>
        <p className="mt-2 text-muted">
          The flame on its tail shows the strength of its life force.
        </p>
      </section>
    </main>
  );
}

export default App;
