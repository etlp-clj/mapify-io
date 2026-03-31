
import React, { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import Editor from "./Editor";
import { X, Play, Save, History, Maximize, Minimize, ArrowLeft } from "lucide-react";
import { Format, SampleDataItem, TransformResponse, TransformMode } from "@/types/data-mapper";
import { convertFormat, transformData } from "@/utils/format-converter";
import { SampleDataDropdown } from "./data-mapper/SampleDataDropdown";
import { SampleDataEditor } from "./data-mapper/SampleDataEditor";
import { toast } from "./ui/use-toast";
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import { useNavigate } from "react-router-dom";
import { API_CONFIG, ROUTES } from "@/config/constants";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable";
import { ApiService } from "@/services/api";

interface MappingData {
  id: number;
  title: string;
  content: {
    tags: string[];
    yaml: string;
    test_data: any[];
  };
  created_at: string;
  updated_at: string;
  href: string;
}

interface DataMapperProps {
  apiUrl?: string;
  baseUrl?: string;
  apiService?: ApiService;
}

const DataMapper: React.FC<DataMapperProps> = ({ apiUrl, baseUrl = 'http://localhost:3031', apiService }) => {
  const navigate = useNavigate();
  const [mappingRules, setMappingRules] = useState("");
  const [sampleDataList, setSampleDataList] = useState<SampleDataItem[]>([]);
  const [output, setOutput] = useState("");
  const [format, setFormat] = useState<Format>("yaml");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState("");
  const [isEditingYaml, setIsEditingYaml] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transformLoading, setTransformLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [mappingData, setMappingData] = useState<MappingData | null>(null);
  const [transformMode, setTransformMode] = useState<TransformMode>("apply");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [lastTransformedSample, setLastTransformedSample] = useState<string | null>(null);

  useEffect(() => {
    if (apiUrl) {
      fetchMappingData();
    }
  }, [apiUrl]);

  useEffect(() => {
    // Add ESC key handler to exit fullscreen mode
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullScreen]);

  const fetchMappingData = async () => {
    if (!apiUrl || !apiService) return;
    
    setLoading(true);
    try {
      // Extract the path from the full URL
      const urlPath = apiUrl.replace(baseUrl, '');
      const data: MappingData = await apiService.get(urlPath);
      setMappingData(data);
      
      // Set the mapping rules from the API data
      setMappingRules(data.content.yaml);
      
      // Convert test_data to our sample data format
      if (data.content.test_data && Array.isArray(data.content.test_data)) {
        const samples = data.content.test_data.map((item, index) => {
          const isYaml = typeof item.data === 'string' && item.data.trim().startsWith('data:');
          return {
            id: item.id || `sample-${index}`,
            name: item.dataTitle || `Sample ${index + 1}`,
            data: item.data || '',
            isYaml: isYaml,
            dataTitle: item.dataTitle
          };
        });
        
        setSampleDataList(samples.length > 0 ? samples : getDefaultSamples());
      } else {
        // Add default samples if none exist
        setSampleDataList(getDefaultSamples());
      }
      
      toast({
        title: "Mapping data loaded",
        description: `Successfully loaded "${data.title}" mapping configuration.`,
      });
    } catch (error) {
      console.error("Error fetching mapping data:", error);
      toast({
        title: "Error loading data",
        description: "Failed to load mapping configuration. Please try again.",
        variant: "destructive",
      });
      setSampleDataList(getDefaultSamples());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultSamples = (): SampleDataItem[] => {
    return [
      {
        id: "1",
        name: "Simple User Data",
        data: JSON.stringify({
          name: "John Doe",
          age: 30,
          email: "john@example.com",
          address: {
            street: "123 Main St",
            city: "New York",
            country: "USA"
          }
        }, null, 2),
        isYaml: false
      },
      {
        id: "2",
        name: "YAML Sample",
        data: `data:
  meta: 
    Key: "somekey"
    Bucket: "somebucket"
  user:
    name: "Jane Smith"
    age: 28
    email: "jane@example.com"
    address:
      street: "456 Oak Ave"
      city: "San Francisco"
      country: "USA"`,
        isYaml: true,
        dataTitle: "yaml_sample"
      }
    ];
  };

  const handleFormatChange = (newFormat: Format) => {
    if (newFormat === format) {
      return; // No need to convert if format is the same
    }

    try {
      // Convert the mapping rules
      const convertedRules = convertFormat(mappingRules, format, newFormat);
      setMappingRules(convertedRules);
      
      // Also convert the output if it exists
      if (output) {
        const convertedOutput = convertFormat(output, format, newFormat);
        setOutput(convertedOutput);
      }
      
      // Set the new format
      setFormat(newFormat);
      
      // Show success toast
      toast({
        title: `Format changed to ${newFormat.toUpperCase()}`,
        description: "Content successfully converted to the new format."
      });
    } catch (error) {
      console.error("Format conversion error:", error);
      toast({
        title: "Format conversion failed",
        description: "Failed to convert between formats. Keeping original format.",
        variant: "destructive",
      });
    }
  };

  const handleTransform = async (data: string, isYaml: boolean = false, sampleName?: string) => {
    setTransformLoading(true);
    try {
      if (transformMode === "apply" && mappingData?.id) {
        await transformWithApplyEndpoint(data, isYaml);
      } else {
        await transformWithTestEndpoint(data, isYaml);
      }
      
      // Store the name of the sample that was just transformed
      setLastTransformedSample(sampleName || "Custom Data");
      
    } catch (error) {
      console.error("Transform error:", error);
      toast({
        title: "Transformation failed",
        description: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
      setOutput("Error during transformation. Check console for details.");
    } finally {
      setTransformLoading(false);
      setShowOutput(true);
    }
  };

  const transformWithApplyEndpoint = async (data: string, isYaml: boolean = false) => {
    if (!mappingData?.id) {
      throw new Error("No mapping ID available");
    }

    let parsedData;
    if (isYaml) {
      try {
        parsedData = yamlParse(data);
      } catch (e) {
        throw new Error(`YAML parsing error: ${e instanceof Error ? e.message : "Invalid YAML"}`);
      }
    } else {
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        throw new Error(`JSON parsing error: ${e instanceof Error ? e.message : "Invalid JSON"}`);
      }
    }

    if (!apiService) {
      throw new Error("API service not available");
    }

    const result = await apiService.post(`/mappings/${mappingData.id}/apply`, { data: parsedData });
    
    // Format the output based on current format preference
    if (format === "yaml") {
      setOutput(yamlStringify(result));
    } else {
      setOutput(JSON.stringify(result, null, 2));
    }

    toast({
      title: "Transformation successful",
      description: "Data has been transformed using the apply endpoint.",
    });
  };

  const transformWithTestEndpoint = async (data: string, isYaml: boolean = false) => {
    let requestBody;
    
    if (isYaml) {
      // For YAML data, we need to create a specific format with template and scope
      const yamlRequest = `template: \n${mappingRules.split('\n').map(line => `  ${line}`).join('\n')}\nscope: \n${data.split('\n').map(line => `  ${line}`).join('\n')}`;
      requestBody = yamlRequest;
    } else {
      // For JSON data
      try {
        const jsonData = JSON.parse(data);
        requestBody = yamlStringify({
          template: mappingRules,
          scope: jsonData
        });
      } catch (e) {
        throw new Error(`JSON parsing error: ${e instanceof Error ? e.message : "Invalid JSON"}`);
      }
    }

    if (!apiService) {
      throw new Error("API service not available");
    }

    // For the test endpoint, we need to send YAML content with special headers
    // Since our API service always sends JSON, we need to use fetch directly for YAML content
    const token = apiService.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/x-yaml'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}/mappings/test`, {
      method: 'POST',
      headers,
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    
    // Format the output based on current format preference
    if (format === "yaml") {
      setOutput(yamlStringify(result));
    } else {
      setOutput(JSON.stringify(result, null, 2));
    }

    toast({
      title: "Transformation successful",
      description: "Data has been transformed using the test endpoint.",
    });
  };

  const saveMapping = async () => {
    if (!mappingData?.id) {
      toast({
        title: "Save failed",
        description: "No mapping ID available to save changes.",
        variant: "destructive",
      });
      return;
    }

    setSaveLoading(true);
    try {
      // Prepare the test_data from sampleDataList
      const testData = sampleDataList.map(item => ({
        id: item.id,
        data: item.data,
        dataTitle: item.name || item.dataTitle
      }));

      // Prepare the data for the PUT request
      const data = {
        content: {
          yaml: mappingRules,
          tags: mappingData.content.tags || [],
          test_data: testData
        }
      };

      if (!apiService) {
        throw new Error("API service not available");
      }

      await apiService.put(`/mappings/${mappingData.id}`, data);

      // Update the local mapping data with our changes since PUT succeeded
      setMappingData({
        ...mappingData,
        content: {
          ...mappingData.content,
          yaml: mappingRules,
          test_data: testData
        },
        updated_at: new Date().toISOString()
      });

      toast({
        title: "Mapping saved",
        description: "Your changes have been saved successfully.",
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Save failed",
        description: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const viewMappingHistory = () => {
    if (mappingData?.id) {
      navigate(ROUTES.MAPPING_HISTORY(mappingData.id));
    }
  };

  const navigateToMappingsList = () => {
    navigate(ROUTES.MAPPINGS);
  };

  const addSampleData = () => {
    const newItem: SampleDataItem = {
      id: Date.now().toString(),
      name: `Sample Data ${sampleDataList.length + 1}`,
      data: "",
      isYaml: false
    };
    setSampleDataList([...sampleDataList, newItem]);
    setEditingId(newItem.id);
    setEditingData("");
    setIsEditingYaml(false);
  };

  const deleteSampleData = (id: string) => {
    setSampleDataList(sampleDataList.filter(item => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditingData("");
      setIsEditingYaml(false);
    }
  };

  const startEditing = (item: SampleDataItem) => {
    setEditingId(item.id);
    setEditingData(item.data);
    setIsEditingYaml(!!item.isYaml);
  };

  const saveEditing = () => {
    if (editingId) {
      setSampleDataList(sampleDataList.map(item => 
        item.id === editingId ? { 
          ...item, 
          data: editingData,
          isYaml: isEditingYaml 
        } : item
      ));
      setEditingId(null);
      setEditingData("");
      setIsEditingYaml(false);
    }
  };

  const toggleTransformMode = () => {
    setTransformMode(prev => prev === "test" ? "apply" : "test");
    toast({
      title: `Transform mode: ${transformMode === "test" ? "Apply" : "Test"}`,
      description: `Now using the ${transformMode === "test" ? "apply" : "test"} endpoint for transformations.`,
    });
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
    
    if (!isFullScreen) {
      toast({
        title: "Fullscreen mode enabled",
        description: "Press ESC key to exit fullscreen mode.",
      });
    }
  };

  return (
    <div className={`flex flex-col min-h-screen bg-background animate-fade-in ${isFullScreen ? 'fixed inset-0 z-50' : ''}`}>
      <header className={`${isFullScreen ? 'bg-background/95 backdrop-blur' : 'border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'}`}>
        <div className="container flex h-14 max-w-screen-2xl items-center">
          <div className="flex items-center mr-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 mr-2"
              onClick={navigateToMappingsList}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-xl font-semibold">
              {mappingData ? mappingData.title : "Data Mapper"}
            </h1>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8"
                onClick={toggleTransformMode}
              >
                Mode: {transformMode === "test" ? "Test" : "Apply"}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8"
                onClick={viewMappingHistory}
                disabled={!mappingData?.id}
              >
                <History className="mr-1 h-4 w-4" />
                History
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8"
                onClick={saveMapping}
                disabled={saveLoading || !mappingData?.id}
              >
                {saveLoading ? "Saving..." : "Save"}
                <Save className="ml-1 h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8"
                onClick={toggleFullScreen}
              >
                {isFullScreen ? (
                  <>
                    <Minimize className="mr-1 h-4 w-4" />
                    Exit Fullscreen
                  </>
                ) : (
                  <>
                    <Maximize className="mr-1 h-4 w-4" />
                    Fullscreen
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Tabs value={format} onValueChange={(value) => handleFormatChange(value as Format)}>
                <TabsList className="h-8">
                  <TabsTrigger value="yaml" className="text-xs">YAML</TabsTrigger>
                  <TabsTrigger value="json" className="text-xs">JSON</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>
      </header>

      <div className={`${isFullScreen ? 'w-full p-0' : 'container mx-auto p-6'} flex-1 flex flex-col`}>
        {isFullScreen ? (
          <div className="flex-1 flex flex-col">
            {showOutput ? (
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Card className="rounded-none border-0 shadow-none flex flex-col h-full">
                  <div className="flex items-center justify-between p-2 border-b">
                    <div className="text-sm font-medium">Mapping Rules</div>
                    <div className="flex items-center">
                      {transformLoading && <div className="text-xs text-muted-foreground mr-2">Processing...</div>}
                      <SampleDataDropdown
                        sampleDataList={sampleDataList}
                        onAddSample={addSampleData}
                        onEdit={startEditing}
                        onTransform={(data, isYaml, name) => handleTransform(data, isYaml, name)}
                        onDelete={deleteSampleData}
                        className="ml-2"
                      />
                    </div>
                  </div>
                  <div className="flex-1 w-full overflow-hidden">
                    <Editor
                      value={mappingRules}
                      onChange={setMappingRules}
                      language={format}
                      height="calc(100vh - 7rem)"
                    />
                  </div>
                </Card>
                
                <Card className="rounded-none border-0 shadow-none flex flex-col h-full">
                  <div className="flex items-center justify-between p-2 border-b">
                    <div className="flex items-center">
                      <span className="text-sm font-medium">Output</span>
                      {lastTransformedSample && (
                        <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
                          {lastTransformedSample}
                        </span>
                      )}
                    </div>
                    <Button 
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => setShowOutput(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 w-full overflow-hidden">
                    <Editor
                      value={output}
                      onChange={setOutput}
                      language={format}
                      readOnly
                      height="calc(100vh - 7rem)"
                    />
                  </div>
                </Card>
              </div>
            ) : (
              <Card className="rounded-none border-0 shadow-none flex flex-col h-full">
                <div className="flex items-center justify-between p-2 border-b">
                  <div className="text-sm font-medium">Mapping Rules</div>
                  <div className="flex items-center">
                    {transformLoading && <div className="text-xs text-muted-foreground mr-2">Processing...</div>}
                    <SampleDataDropdown
                      sampleDataList={sampleDataList}
                      onAddSample={addSampleData}
                      onEdit={startEditing}
                      onTransform={(data, isYaml, name) => handleTransform(data, isYaml, name)}
                      onDelete={deleteSampleData}
                      className="ml-2"
                    />
                  </div>
                </div>
                <div className="flex-1 w-full overflow-hidden">
                  <Editor
                    value={mappingRules}
                    onChange={setMappingRules}
                    language={format}
                    height="calc(100vh - 7rem)"
                  />
                </div>
              </Card>
            )}
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            <ResizablePanel defaultSize={75} minSize={30}>
              <Card className="rounded-md border shadow-md flex flex-col h-full">
                <div className="flex items-center justify-between p-2 border-b">
                  <div className="text-sm font-medium">Mapping Rules</div>
                  <div className="flex items-center">
                    {transformLoading && <div className="text-xs text-muted-foreground mr-2">Processing...</div>}
                    <SampleDataDropdown
                      sampleDataList={sampleDataList}
                      onAddSample={addSampleData}
                      onEdit={startEditing}
                      onTransform={(data, isYaml, name) => handleTransform(data, isYaml, name)}
                      onDelete={deleteSampleData}
                      className="ml-2"
                    />
                  </div>
                </div>
                <div className="flex-1 w-full overflow-hidden">
                  <Editor
                    value={mappingRules}
                    onChange={setMappingRules}
                    language={format}
                    height="calc(100vh - 12rem)"
                  />
                </div>
              </Card>
            </ResizablePanel>
            
            {showOutput && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={25} minSize={20}>
                  <Card className="rounded-md border shadow-md flex flex-col h-full">
                    <div className="flex items-center justify-between p-2 border-b">
                      <div className="flex items-center">
                        <span className="text-sm font-medium">Output</span>
                        {lastTransformedSample && (
                          <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
                            {lastTransformedSample}
                          </span>
                        )}
                      </div>
                      <Button 
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => setShowOutput(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 w-full overflow-hidden">
                      <Editor
                        value={output}
                        onChange={setOutput}
                        language={format}
                        readOnly
                        height="calc(100vh - 12rem)"
                      />
                    </div>
                  </Card>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        )}
      </div>

      <SampleDataEditor
        isOpen={!!editingId}
        onOpenChange={(open) => !open && setEditingId(null)}
        value={editingData}
        onChange={setEditingData}
        onSave={saveEditing}
        isYaml={isEditingYaml}
        globalFormat={format}
      />
    </div>
  );
};

export default DataMapper;
