import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import RacquetDetail from './pages/RacquetDetail'
import Layout from './components/Layout'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/racquets/:id" element={<RacquetDetail />} />
      </Routes>
    </Layout>
  )
}
