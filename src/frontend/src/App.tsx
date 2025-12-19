import { ChakraProvider, defaultSystem} from '@chakra-ui/react'
import { ColorModeProvider } from './components/ui/color-mode'
import { Flex } from '@chakra-ui/react'
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import Lightcurves from './components/pages/Lightcurves';
import Style from './components/pages/Style';
import Sonify from './components/pages/Sonify';
import Help from './components/pages/Help';
import Home from './components/pages/Home';
import Settings from './components/pages/Settings'
import Refine from './components/pages/Refine';
import Constellations from './components/pages/Constellations';
import { useEffect, useState, useRef } from 'react';
import { coreAPI } from './apiConfig';

function App() {

  const [sessionReady, setSessionReady] = useState(false);
  const sessionInitialised = useRef(false);

  useEffect(() => {
    // runs once when the app first loads to get a session ID from backend

    if (sessionInitialised.current) return; // to prevent 
    sessionInitialised.current = true;

    async function setupSession() {
      const response = await fetch(`${coreAPI}/session/`, {
        credentials: 'include'  // Tell browser to send/save cookies
      });
      const data = await response.json();
      console.log('Session ID:', data.session_id);
      setSessionReady(true);
    }
    
    setupSession();
  }, []);

  if (!sessionReady) {
    return <div>Loading...</div>
  }

  return (
    <ChakraProvider value={defaultSystem}>
      <ColorModeProvider>
        <Flex direction="column" align="center" justify="flex-start" minH="100vh" p={8} bg="bg">
          <HashRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/light-curves" element={<Lightcurves />} />
              <Route path="/constellations" element={<Constellations />} />
              <Route path="/refine" element={<Refine />} />
              <Route path="/style" element={<Style />} />
              <Route path="/sonify" element={<Sonify />} />
              <Route path='/help' element={<Help />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </HashRouter>
        </Flex>
      </ColorModeProvider>
    </ChakraProvider>
  )
}

export default App;

