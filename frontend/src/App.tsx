import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Enrollment from './pages/Enrollment'
import Result from './pages/Result'

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/enroll" element={<Enrollment />} />
        <Route path="/result" element={<Result />} />
      </Routes>
    </div>
  )
}

export default App
