import React, { useEffect, useState, createContext, ChangeEvent, useRef } from "react";
import { data, useLocation, useNavigate } from 'react-router-dom';
import StyleCard from "../ui/StyleCard";
import {BackButton} from "../ui/Buttons";
import PageContainer from "../ui/PageContainer";
import { ToggleTip, InfoTip } from "../ui/ToggleTip";
import { Tooltip } from "../ui/Tooltip";
import { apiUrl, lightCurvesAPI, coreAPI} from "../../apiConfig";

import {
  Box,
  Button,
  Card,
  Checkbox,
  Collapsible,
  createListCollection,
  Dialog,
  Heading,
  HStack,
  Link,
  LinkBox,
  LinkOverlay,
  SegmentGroup,
  Select,
  Stack,
  Switch,
  Text  
} from "@chakra-ui/react";
import { apiRequest } from "../../utils/requests";

export default function Style() {

    const navigate = useNavigate();
    // location and state information 
    const location = useLocation();
    const dataName = location.state.dataName;
    const dataRef = location.state.dataRef;
    const soniType = location.state.soniType;
    const ra = location.state.ra ?? null;
    const dec = location.state.dec ?? null;

    console.log('ra: ' + ra)
    console.log('dec: ' + dec)

    interface BaseSound { 
        name: string
        composable: boolean
        downloaded: boolean
    };

    const defaultSound: BaseSound = {
        name: 'Default Synth 🎹',
        composable: true,
        downloaded: true
    }

    // State to manage the dialog open/close
    const [open, setOpen] = useState(false);

    // Suggested styles
    const [suggestedStyles, setSuggestedStyles] = useState<any[]>([]);

    // Reference to the file input
    const inputRef = useRef<HTMLInputElement | null>(null);

    
    useEffect(() => {
        fetch(`${coreAPI}/styles/${soniType}`)
            .then((res) => res.json())
            .then((data) => {

                if (soniType == 'light_curves'){
                    data.push({'name': 'Custom'})
                }
                
                setSuggestedStyles(data);
                console.log(suggestedStyles)
            })
            .catch((err) => {
                console.error("Failed to fetch presets:", err);
            });
    }, []);

    useEffect(() => {

        setLoadingSounds(true)

        const fetchSounds = async () => {
            try {
                const response = await fetch(`${coreAPI}/sound_info/`)

                if (!response.ok) {
                    throw new Error('Failed to fetch sounds');
                    }
                const soundsData: BaseSound[] = await response.json();

                const collection = createListCollection({
                    items: soundsData.map(sound => ({
                        ...sound,
                        label: `${sound.name}${sound.composable ? ' 🎹' : ''}`,  // Add piano emoji for composable sounds
                        value: sound.name
                    }))
                });
                setSoundOptions(collection);
            } catch (error) {
                console.error('Error fetching sounds:', error);
            } finally {
                setLoadingSounds(false);
            }
        }

        fetchSounds();
    }, []);



    // Sound parameters for sonification
    const [sound, setSound] = useState<BaseSound>(defaultSound);
    const [filterCutoff, setFilterCutoff] = useState<boolean | 'indeterminate'>(false);
    const [pitch, setPitch] = useState(false);
    const [volume, setVolume] = useState(false);
    const [leftRightPan, setLeftRightPan] = useState(false);
    const [chordMode, setChordMode] = useState(false);
    const [rootNote, setRootNote] = useState('C');
    const [scale, setScale] = useState('None');
    const [quality, setQuality] = useState('maj');
    const [soundOptions, setSoundOptions] = useState(
        createListCollection<BaseSound & { label: string; value: string }>({ items: [] })
    );
    const [loadingSounds, setLoadingSounds] = useState(true);
    const [loadingCustomPreview, setLoadingCustomPreview] = useState(false)

    const rootNoteOptions = createListCollection({
        items: [
            //C, C#/Db, D, D#/Eb, E, F, F#/Gb, G, G#/Ab, A, A#/Bb, B
            { label: "C", value: "C" },
            { label: "C#/Db", value: "C#" },
            { label: "D", value: "D" },
            { label: "D#/Eb", value: "D#" },
            { label: "E", value: "E" },
            { label: "F", value: "F" },
            { label: "F#/Gb", value: "F#" },
            { label: "G", value: "G" },
            { label: "G#/Ab", value: "G#" },
            { label: "A", value: "A" },
            { label: "A#/Bb", value: "A#" },
            { label: "B", value: "B" },
        ],
    });
    const scaleOptions = createListCollection({
        items: [
            { label: "None", value: "None" },
            { label: "Major", value: "major" },
            { label: "Harmonic Minor", value: "harmonic minor" },
            { label: "Pentatonic", value: "pentatonic minor" },
            { label: "Blues", value: "blues" },
            { label: "Chromatic", value: "chromatic" },
            { label: "Flamenco", value: "flamenco" },
            { label: "Romani", value: "romani" },
            { label: "Hirajoshi", value: "hijaroshi" },
            { label: "Persian", value: "persian" },
            { label: "Phrygian Dominant", value: "phrygian dominant" },           
        ],
    });
    const qualityOptions = createListCollection({
        //maj, min, maj7, maj9, 5, 6, 7, 9, m7, m9, sus2, sus4, 7sus4, add9, madd9
        items: [
            { label: "Major", value: "maj" },
            { label: "Minor", value: "min" },
            { label: "Major 7", value: "maj7" },
            { label: "Major 9", value: "maj9" },
            { label: "5", value: "5" },
            { label: "6", value: "6" },
            { label: "7", value: "7" },
            { label: "9", value: "9" },
            { label: "Minor 7", value: "m7" },
            { label: "Minor 9", value: "m9" },
            { label: "Sus2", value: "sus2" },
            { label: "Sus4", value: "sus4" },
            { label: "7sus4", value: "7sus4" },
            { label: "Add9", value: "add9" },
            { label: "Minor Add9", value: "madd9" },
        ],
    });
    const parameters = ["Filter Cutoff", "Pitch", "Volume", "Left/Right Pan"] as const;
    
    const saveSoundSettings = async () => {

        const url = `${coreAPI}/save-sound-settings/`;
        const data = { 
            "sound": sound.name.replace(/\s*🎹$/, ""),
            "filterCutOff": filterCutoff,
            "pitch": pitch,
            "volume": volume,
            "leftRightPan": leftRightPan,
            "chordMode": chordMode,
            "rootNote": rootNote,
            "scale": scale,
            "quality": quality 
        }

        const response = await apiRequest(url, data);

        return response.file_ref;
    }

    const handleClick  = async (style: any) => {
        if (style.name === "Custom") {
            console.log("Custom sound settings selected, opening dialog...");
            setOpen(true);
        } else {
            const styleName = style.name
            const styleDescription = style.description
            console.log('desc: ' + styleDescription)
            console.log("Selected style:", styleName);
            const styleRef = style.file_ref;
            console.log("File reference of selected style:", styleRef);
            // Navigate to the Sonify page with the selected style
            navigate('/sonify', { state: { dataName, dataRef, styleName, styleDescription, styleRef, soniType, ra, dec } });
        }
    }

    const ensureSoundAvailable = async (soundName: string) => {
        // ensure the sound is available by downloading if necessary
        await apiRequest(`${coreAPI}/ensure-sound-available/`, {sound_name: soundName});
    }

    const handlePreviewStyle = async () => {
        try {
            setLoadingCustomPreview(true)
            ensureSoundAvailable(sound.name);

            // Wait for sound settings to save and get filepath
            const fileRef = await saveSoundSettings();
            console.log(fileRef)

            const preview_endpoint = `${coreAPI}/preview-style-settings/${soniType}`;

            const response = await apiRequest(preview_endpoint,{file_ref: fileRef});
            const audioUrl = `${coreAPI}/audio/${response.file_ref}`;
            const preview = new Audio(audioUrl);
            preview.play()
            setLoadingCustomPreview(false)

        } catch (err) {
            console.error("Error previewing style settings:", err);
        }
    };

    const handleSubmit = async () => {
    try {
        ensureSoundAvailable(sound.name)
        // save sound settings
        saveSoundSettings().then((styleRef) => {
            console.log("Saved custom style as:", styleRef);
            // navigate
            const styleName = 'Custom'
            navigate('/sonify', { state: { dataName, dataRef, styleName, styleRef, soniType, ra, dec } });
        });
    } catch (err) {
        console.error("Error saving custom style:", err);
    }
    };


    // TO DO: Move all the below into the actual onClick props in the JSX?

    const handleChangeFilterCutoff = (details: { checked: boolean | "indeterminate" }) => {
        setFilterCutoff(details.checked);
        //setSettings((prev) => ({ ...prev, FilterCutoff: details.checked === true }));
        console.log("Filter Cutoff:", details.checked);
    };

    const handleChangePitch = (details: { checked: boolean | "indeterminate" }) => {
    console.log("handleChangePitch called with:", details);
    console.log("details.checked === false:", details.checked === false);
    console.log("Current scale before:", scale);
    
    setPitch(details.checked === true);
    
    if (details.checked === false) {
        console.log("Setting scale to None");
        setScale('None');
        console.log('Scale: ' + scale)
    }
    
    console.log("Pitch:", details.checked);
    };

    const handleChangeVolume = (details: { checked: boolean | "indeterminate" }) => {
        setVolume(details.checked === true);
        //setSettings((prev) => ({ ...prev, Volume: details.checked === true }));
        console.log("Volume:", details.checked);
    };

    const handleChangeLeftRightPan = (details: { checked: boolean | "indeterminate" }) => {
        setLeftRightPan(details.checked === true);
        //setSettings((prev) => ({ ...prev, LeftRightPan: details.checked === true }));
        console.log("Left/Right Pan:", details.checked);
    };

    const handleSelectSound = (details: { value: string[] }) => {
        if (details.value && details.value.length > 0) {
            const selectedSoundName = details.value[0];
            
            // Find the full object from soundOptions
            const selectedSoundItem = soundOptions.items.find(item => item.value === selectedSoundName);
            
            if (selectedSoundItem) {
                setSound(selectedSoundItem);
                console.log("Selected Sound:", selectedSoundItem);
            }
        }
    };

    const handleChordMode = (details: { checked: boolean | "indeterminate" }) => {
        setChordMode(details.checked === true);
        //setSettings((prev) => ({ ...prev, ChordMode: details.checked === true }));
        console.log("Chord Mode:", details.checked);
    };

    const handleSelectRootNote = (event: React.FormEvent<HTMLDivElement>) => {
        const target = event.target as HTMLSelectElement;
        setRootNote(target.value);
        //setSettings((prev) => ({ ...prev, RootNote: target.value }));
        console.log("Selected Root Note:", target.value);
    };

    const handleSelectScale = (event: React.FormEvent<HTMLDivElement>) => {
        const target = event.target as HTMLSelectElement;
        setScale(target.value);
        setPitch(target.value !== 'None');
        console.log("Selected Scale:", target.value);
    };

    const handleSelectQuality = (event: React.FormEvent<HTMLDivElement>) => {
        const target = event.target as HTMLSelectElement;
        setQuality(target.value);
        //setSettings((prev) => ({ ...prev, Quality: target.value }));
        console.log("Selected Quality:", target.value);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onFileSelect(file); // Send file to parent or upload logic
        }
    };

    const onFileSelect = async (file: File) => {
        console.log("File selected:", file);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await apiRequest(`${coreAPI}/upload-yaml/`, formData);
            console.log("File uploaded successfully:", res.file_ref);
            const styleRef = res.file_ref;
            // Navigate to the Sonify page with the uploaded file
            navigate('/sonify', { state: {dataName, dataRef, styleRef, soniType, ra, dec } });
        
        } catch (err: any) {
            //setResponse({ error: err.message });
        }
        
    }

    const handleButtonClick = () => {
        console.log("Upload Custom YAML File clicked");
        inputRef.current?.click(); // Programmatically open file dialog
    };

    return (
        <PageContainer>
            <Box position='relative' as="main" role="main">
                <Heading as='h1'>  Step 2: Style</Heading>
                <br />
                <Text textStyle="lg">Choose from the styles below, or configure your own</Text>
                <br />

                <Stack gap="6" direction="row" wrap="wrap" animation="fade-in 300ms ease-out">
                    {suggestedStyles.map((style, index) => {
                        const gradientClasses = ['gradient-aurora', 'gradient-neon', 'gradient-darkwave', 'gradient-sunset', 'gradient-ocean', 'gradient-forest'];
                        const gradientClass = style.name === 'Custom' ? 'gradient-custom' : gradientClasses[index % gradientClasses.length];

                        return (
                        <Box
                            key={style.name} 
                            onClick={() => handleClick(style)} 
                            style={{ cursor: 'pointer', width: 200 }}
                            tabIndex={0}
                            role="button"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleClick(style);
                                }}
                            }
                            >
                            <StyleCard title={style.name} description={style.description} gradientClass={gradientClass} isCustom={style.name === 'Custom'}/>
                        </Box>
                        );
                    })}
                </Stack>
            </Box>
        </PageContainer>
    )
}