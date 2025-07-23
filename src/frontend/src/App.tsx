import { ChakraProvider } from '@chakra-ui/react'
import { defaultSystem } from "@chakra-ui/react"
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Lightcurves from './components/Lightcurves';
import Sound from './components/Sound';
import Sidebar from './components/Sidebar';

function App() {

  return (
    <ChakraProvider value={defaultSystem}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Lightcurves />} />
          <Route path="/sound" element={<Sound />} />
        </Routes>
      </BrowserRouter>
    </ChakraProvider>
  )
}

export default App;

