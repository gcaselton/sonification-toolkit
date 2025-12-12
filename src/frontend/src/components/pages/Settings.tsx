import React, { useEffect, useState, ChangeEvent } from "react";
import { useNavigate } from 'react-router-dom';
import LoadingMessage from '../ui/LoadingMessage';
import PageContainer from "../ui/PageContainer";
import { settingsAPI } from "../../apiConfig";

import {
  Box,
  Alert,
  Button,
  Heading,
  VStack,
  Text,
  Slider,
  Field,
} from "@chakra-ui/react";
import { apiRequest } from "../../utils/requests";

export default function Settings() {

  const navigate = useNavigate();
  const [dataResolution, setDataResolution] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  // Load current settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await apiRequest(`${settingsAPI}/load-settings`,{}, 'GET');
    
      setDataResolution(settings.data_resolution || 10);
    } catch (error) {
      console.error('Error loading settings:', error);
      setErrorMessage('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newResolution: number) => {
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    
    try {
      const url = `${settingsAPI}/save-settings`
      const data = {
        data_resolution: newResolution
      }
      const response = await apiRequest(url, data);
      
      setSuccessMessage('Settings saved successfully!');
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setErrorMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResolutionChange = (details: any) => {
    const newValue = details.value[0];
    setDataResolution(newValue);
  };

  const resolutionMarks = [
    {value: 1, label: '1'},
    {value: 10, label: '10'},
    {value: 20, label: '20'}
  ]

  if (loading) {
    return (
      <PageContainer hideBackButton showHome>
        <LoadingMessage msg="Loading settings..." />
      </PageContainer>
    );
  }

  return (
    <PageContainer hideBackButton showHome>
      <Box as="main" role="main">
        <Heading size="4xl">Settings</Heading>
        <br />
        
        <VStack gap="6" align="stretch" maxWidth="500px">
          {errorMessage && (
            <Alert.Root status="error">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{errorMessage}</Alert.Title>
              </Alert.Content>
            </Alert.Root>
          )}
          
          {successMessage && (
            <Alert.Root status="success">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{successMessage}</Alert.Title>
              </Alert.Content>
            </Alert.Root>
          )}

          <Field.Root>
            <Field.Label>
              Data Resolution: <b>{dataResolution}</b>
            </Field.Label>
            <Field.HelperText mb={3}>
              This is the number of data points played per second when mapping to a musical scale. (1 = lowest, 20 = highest)
            </Field.HelperText>
            <Slider.Root 
              value={[dataResolution]}
              onValueChange={handleResolutionChange}
              min={1}
              max={20}
              step={1}
              width="100%"
              disabled={saving}
              colorPalette='teal'>
              <Slider.Control>
                <Slider.Track>
                  <Slider.Range />
                </Slider.Track>
                <Slider.Thumbs />
                <Slider.Marks marks={resolutionMarks}/>
              </Slider.Control>
            </Slider.Root>
          </Field.Root>

          <Button 
            onClick={() => saveSettings(dataResolution)} 
            colorPalette="teal" 
            loading={saving} 
            alignSelf="flex-start"
          >
            Save
          </Button>

        </VStack>
      </Box>
    </PageContainer>
  );
}