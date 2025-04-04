import { Layout } from './components/templates/Layout'
import { OCIFGenerator } from './components/molecules/OCIFGenerator'

function App() {
  return (
    <Layout>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-zinc-900">OCIF JSON Generator</h1>
        <OCIFGenerator />
      </div>
    </Layout>
  )
}

export default App
