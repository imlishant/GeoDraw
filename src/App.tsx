import AppCanvas from './components/AppCanvas';
import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import PropertiesPanel from './components/PropertiesPanel';

function App() {
  return (
    <div className="w-full h-full bg-gray-50 dark:bg-gray-950 relative">
      <AppCanvas />
      <Toolbar />
      <PropertiesPanel />
      <StatusBar />
    </div>
  );
}

export default App;