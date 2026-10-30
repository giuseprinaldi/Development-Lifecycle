import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Admin } from './pages/Admin'
import { NewProposal } from './pages/NewProposal'
import { ProposalDetail } from './pages/ProposalDetail'
import { ProposalsList } from './pages/ProposalsList'
import { WaitingOnMe } from './pages/WaitingOnMe'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/proposals" replace />} />
            <Route path="/proposals" element={<ProposalsList />} />
            <Route path="/proposals/new" element={<NewProposal />} />
            <Route path="/proposals/:id" element={<ProposalDetail />} />
            <Route path="/waiting" element={<WaitingOnMe />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/proposals" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
