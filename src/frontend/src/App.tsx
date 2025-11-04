import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
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

function App() {

  return (
    <ChakraProvider value={defaultSystem}>
      <Flex direction="column" align="center" justify="flex-start" minH="100vh" p={8}>
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
    </ChakraProvider>
  )
}

export default App;

