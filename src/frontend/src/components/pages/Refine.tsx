import { lazy, Suspense } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import PageContainer from "../ui/PageContainer";
import {
  Box,
  Heading,
  Text,
} from "@chakra-ui/react";

export default function Refine() {

    const navigate = useNavigate();
    const location = useLocation();
    const dataName = location.state.dataName
    var dataRef = location.state.dataRef
    const soniType = location.state.soniType
    const ra = location.state.ra ?? null;
    const dec = location.state.dec ?? null;

    // Dynamically import the menu component
    const Menu = lazy(() => import(`../refine_menus/${soniType}.tsx`));


    return(
        <PageContainer>
            <Box position='relative' as='main' role='main'>
                <Heading as='h1'>Step 2: Refine</Heading>
                <br />
                <Text textStyle='lg'>Optionally, edit the {dataName} dataset</Text>
                <br />
                <br />
                <Suspense>
                    <Menu 
                        dataRef={dataRef}
                        dataName={dataName} 
                        onApply={(newRef: string) => {
                            // Navigate with refined data
                            dataRef = newRef;
                            navigate('/style', { state: { dataRef, dataName, soniType, ra, dec } });
                            }}/>
                </Suspense>
            </Box>
        </PageContainer>
    )
}