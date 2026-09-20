import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { Provider } from './store'
import App from './App'
import './styles.css'
ReactDOM.createRoot(document.getElementById('root')!).render(
  <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Provider>
      <App />
    </Provider>
  </HashRouter>,
)
