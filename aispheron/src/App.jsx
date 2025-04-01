import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// API base URL - Change this to your backend URL
const API_BASE_URL = 'http://localhost:8000';

function App() {
  // States for models and UI
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileId, setUploadedFileId] = useState('');
  const [finetuneConfig, setFinetuneConfig] = useState({
    epochs: 3,
    batch_size: 8,
    learning_rate: 5e-5,
    push_to_hub: false,
    repo_name: ''
  });
  
  // States for job tracking
  const [activeJobs, setActiveJobs] = useState([]);
  const [jobLogs, setJobLogs] = useState({});
  const [jobResults, setJobResults] = useState({});
  
  // Query states
  const [queryModel, setQueryModel] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [queryResult, setQueryResult] = useState('');
  const [queryConfig, setQueryConfig] = useState({
    max_length: 100,
    temperature: 0.7,
    top_p: 0.9,
    top_k: 50
  });
  
  // UI states
  const [activeTab, setActiveTab] = useState('finetune');
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  
  // Refs for polling intervals
  const jobPollRefs = useRef({});

  // Fetch available models on component mount
  useEffect(() => {
    fetchModels();
  }, []);

  // Fetch models from API
  const fetchModels = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/models`);
      setModels(response.data);
      if (response.data.length > 0) {
        setSelectedModel(response.data[0].id);
      }
    } catch (err) {
      setError('Failed to fetch models. Please check if the backend server is running.');
      console.error('Error fetching models:', err);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadedFile(file);
    setUploadProgress(0);
    
    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      
      setUploadedFileId(response.data.file_id);
      setNotification(`File ${file.name} uploaded successfully!`);
      
      // Auto-generate repo name based on file name
      setFinetuneConfig(prev => ({
        ...prev,
        repo_name: `finetuned-${selectedModel.split('/').pop()}-${file.name.split('.')[0]}`
      }));
    } catch (err) {
      setError(`Failed to upload file: ${err.response?.data?.detail || err.message}`);
      console.error('Upload error:', err);
    }
  };

  // Handle fine-tuning start
  const startFineTuning = async () => {
    if (!selectedModel) {
      setError('Please select a model first.');
      return;
    }
    
    if (!uploadedFileId) {
      setError('Please upload a dataset file first.');
      return;
    }
    
    // Create FormData for fine-tuning request
    const formData = new FormData();
    formData.append('file_id', uploadedFileId);
    formData.append('config', JSON.stringify({
      model_id: selectedModel,
      task_type: 'text-generation',
      ...finetuneConfig
    }));
    
    try {
      setError('');
      setNotification('Starting fine-tuning...');
      
      const response = await axios.post(`${API_BASE_URL}/finetune`, formData);
      const jobId = response.data.job_id;
      
      // Add job to active jobs
      setActiveJobs(prev => [...prev, {
        id: jobId,
        model: selectedModel,
        file: uploadedFile?.name || 'Unknown file',
        startTime: new Date().toLocaleString()
      }]);
      
      // Start polling for job status
      startJobPolling(jobId);
      
      setNotification(`Fine-tuning job started with ID: ${jobId}`);
    } catch (err) {
      setError(`Failed to start fine-tuning: ${err.response?.data?.detail || err.message}`);
      console.error('Fine-tuning error:', err);
    }
  };

  // Poll job status
  const startJobPolling = (jobId) => {
    // Clear any existing interval for this job
    if (jobPollRefs.current[jobId]) {
      clearInterval(jobPollRefs.current[jobId]);
    }
    
    // Create new polling interval
    const intervalId = setInterval(async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/jobs/${jobId}`);
        const { status, logs, result } = response.data;
        
        // Update job logs
        setJobLogs(prev => ({
          ...prev,
          [jobId]: logs
        }));
        
        // If job completed or failed, stop polling and update results
        if (status === 'completed' || status === 'failed') {
          clearInterval(jobPollRefs.current[jobId]);
          delete jobPollRefs.current[jobId];
          
          if (result) {
            setJobResults(prev => ({
              ...prev,
              [jobId]: result
            }));
            
            // Add the fine-tuned model to query options
            if (status === 'completed') {
              setNotification(`Fine-tuning job ${jobId} completed successfully!`);
              setQueryModel(jobId);
            }
          }
          
          // Update job status in activeJobs
          setActiveJobs(prev => 
            prev.map(job => 
              job.id === jobId ? { ...job, status } : job
            )
          );
        }
      } catch (err) {
        console.error(`Error polling job ${jobId}:`, err);
      }
    }, 5000); // Poll every 5 seconds
    
    // Store the interval ID
    jobPollRefs.current[jobId] = intervalId;
  };

  // Send a query to a fine-tuned model
  const sendQuery = async () => {
    if (!queryModel) {
      setError('Please select a model to query.');
      return;
    }
    
    if (!queryInput.trim()) {
      setError('Please enter a query.');
      return;
    }
    
    try {
      setError('');
      setNotification('Sending query...');
      setQueryResult('');
      
      const response = await axios.post(`${API_BASE_URL}/query`, {
        model_id: queryModel,
        query: queryInput,
        ...queryConfig
      });
      
      setQueryResult(response.data.response);
      setNotification('Query processed successfully!');
    } catch (err) {
      setError(`Query failed: ${err.response?.data?.detail || err.message}`);
      console.error('Query error:', err);
    }
  };

  // Handle config changes
  const handleFinetuneConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFinetuneConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              type === 'number' ? parseFloat(value) : value
    }));
  };

  // Handle query config changes
  const handleQueryConfigChange = (e) => {
    const { name, value } = e.target;
    setQueryConfig(prev => ({
      ...prev,
      [name]: parseFloat(value)
    }));
  };

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Clean up all intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(jobPollRefs.current).forEach(clearInterval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-blue-600 text-white py-6 px-4 shadow-md">
        <h1 className="text-3xl font-bold text-center">Language Model Fine-Tuning Platform</h1>
        <p className="text-center mt-2 text-blue-100">Upload datasets, fine-tune models, and query them</p>
      </header>
      
      {/* Notification and Error Messages */}
      <div className="mx-auto w-full max-w-6xl px-4 mt-4">
        {notification && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative flex justify-between items-center">
            <p>{notification}</p>
            <button onClick={() => setNotification('')} className="text-green-700 font-bold text-xl">&times;</button>
          </div>
        )}
        
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex justify-between items-center">
            <p>{error}</p>
            <button onClick={() => setError('')} className="text-red-700 font-bold text-xl">&times;</button>
          </div>
        )}
      </div>
      
      {/* Tab Navigation */}
      <div className="mx-auto w-full max-w-6xl px-4 mt-4">
        <div className="flex border-b border-gray-200">
          <button 
            className={`px-4 py-2 font-medium text-sm focus:outline-none ${
              activeTab === 'finetune' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-500 hover:text-blue-500'
            }`}
            onClick={() => setActiveTab('finetune')}
          >
            Fine-Tune Models
          </button>
          <button 
            className={`px-4 py-2 font-medium text-sm focus:outline-none ${
              activeTab === 'query' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-500 hover:text-blue-500'
            }`}
            onClick={() => setActiveTab('query')}
          >
            Query Models
          </button>
          <button 
            className={`px-4 py-2 font-medium text-sm focus:outline-none ${
              activeTab === 'jobs' 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-500 hover:text-blue-500'
            }`}
            onClick={() => setActiveTab('jobs')}
          >
            Active Jobs {activeJobs.length > 0 && `(${activeJobs.length})`}
          </button>
        </div>
      </div>
      
      {/* Fine-Tuning Tab */}
      {activeTab === 'finetune' && (
        <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Step 1: Select a Base Model</h2>
            <div className="mb-4">
              <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 mb-2">Base Model:</label>
              <select 
                id="model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {models.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Step 2: Upload Dataset</h2>
            <div className="mb-4">
              <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="dataset-file"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                    >
                      <span>{uploadedFile ? uploadedFile.name : 'Choose a file'}</span>
                      <input 
                        id="dataset-file" 
                        name="dataset-file" 
                        type="file" 
                        className="sr-only" 
                        onChange={handleFileUpload}
                        accept=".csv,.json,.txt"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">CSV, JSON, or TXT up to 10MB</p>
                </div>
              </div>
              
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              )}
              
              {uploadedFileId && (
                <div className="mt-4 flex items-center text-green-600">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>File uploaded successfully</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Step 3: Configure Training Parameters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="epochs" className="block text-sm font-medium text-gray-700">Epochs:</label>
                <input 
                  type="number" 
                  id="epochs"
                  name="epochs"
                  min="1"
                  max="10"
                  value={finetuneConfig.epochs}
                  onChange={handleFinetuneConfigChange}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="batch_size" className="block text-sm font-medium text-gray-700">Batch Size:</label>
                <input 
                  type="number" 
                  id="batch_size"
                  name="batch_size"
                  min="1"
                  max="32"
                  value={finetuneConfig.batch_size}
                  onChange={handleFinetuneConfigChange}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="learning_rate" className="block text-sm font-medium text-gray-700">Learning Rate:</label>
                <input 
                  type="number" 
                  id="learning_rate"
                  name="learning_rate"
                  min="0.00001"
                  max="0.1"
                  step="0.00001"
                  value={finetuneConfig.learning_rate}
                  onChange={handleFinetuneConfigChange}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="space-y-2 flex items-center">
                <div className="flex items-center h-5">
                  <input
                    id="push_to_hub"
                    name="push_to_hub"
                    type="checkbox"
                    checked={finetuneConfig.push_to_hub}
                    onChange={handleFinetuneConfigChange}
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="push_to_hub" className="font-medium text-gray-700">Push to Hugging Face Hub</label>
                </div>
              </div>
              
              {finetuneConfig.push_to_hub && (
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="repo_name" className="block text-sm font-medium text-gray-700">Repository Name:</label>
                  <input 
                    type="text" 
                    id="repo_name"
                    name="repo_name"
                    value={finetuneConfig.repo_name}
                    onChange={handleFinetuneConfigChange}
                    placeholder="username/model-name"
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-center">
            <button 
              className={`py-2 px-4 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                !selectedModel || !uploadedFileId 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
              }`}
              onClick={startFineTuning}
              disabled={!selectedModel || !uploadedFileId}
            >
              Start Fine-Tuning
            </button>
          </div>
        </div>
      )}
      
      {/* Query Tab */}
      {activeTab === 'query' && (
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Query Fine-Tuned Models</h2>
            
            <div className="mb-4">
              <label htmlFor="query-model" className="block text-sm font-medium text-gray-700 mb-2">Select Model:</label>
              <select 
                id="query-model"
                value={queryModel}
                onChange={(e) => setQueryModel(e.target.value)}
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a fine-tuned model</option>
                {activeJobs
                  .filter(job => job.status === 'completed')
                  .map(job => (
                    <option key={job.id} value={job.id}>
                      {job.model.split('/').pop()} - {job.file} ({job.startTime})
                    </option>
                  ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label htmlFor="query-input" className="block text-sm font-medium text-gray-700 mb-2">Your Query:</label>
              <textarea 
                id="query-input"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Enter your query here..."
                rows="4"
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>
            
            <div className="mb-6 border border-gray-200 rounded-md p-4 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-800 mb-3">Generation Parameters</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="max_length" className="block text-sm font-medium text-gray-700 mb-1">
                    Max Length: {queryConfig.max_length}
                  </label>
                  <input 
                    type="range" 
                    id="max_length"
                    name="max_length"
                    min="10"
                    max="500"
                    value={queryConfig.max_length}
                    onChange={handleQueryConfigChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                
                <div>
                  <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-1">
                    Temperature: {queryConfig.temperature.toFixed(1)}
                  </label>
                  <input 
                    type="range" 
                    id="temperature"
                    name="temperature"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={queryConfig.temperature}
                    onChange={handleQueryConfigChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                
                <div>
                  <label htmlFor="top_p" className="block text-sm font-medium text-gray-700 mb-1">
                    Top-p: {queryConfig.top_p.toFixed(1)}
                  </label>
                  <input 
                    type="range" 
                    id="top_p"
                    name="top_p"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={queryConfig.top_p}
                    onChange={handleQueryConfigChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                
                <div>
                  <label htmlFor="top_k" className="block text-sm font-medium text-gray-700 mb-1">
                    Top-k: {queryConfig.top_k}
                  </label>
                  <input 
                    type="range" 
                    id="top_k"
                    name="top_k"
                    min="1"
                    max="100"
                    value={queryConfig.top_k}
                    onChange={handleQueryConfigChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-center mb-6">
              <button 
                className={`py-2 px-4 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  !queryModel || !queryInput.trim() 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                }`}
                onClick={sendQuery}
                disabled={!queryModel || !queryInput.trim()}
              >
                Generate Response
              </button>
            </div>
            
            {queryResult && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-800 mb-2">Model Response:</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 whitespace-pre-wrap">
                  {queryResult}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Jobs Tab */}
      {activeTab === 'jobs' && (
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Active and Completed Jobs</h2>
            
            {activeJobs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No jobs have been started yet.</p>
            ) : (
              <div className="space-y-6">
                {activeJobs.map(job => (
                  <div key={job.id} className={`border rounded-md overflow-hidden ${
                    job.status === 'completed' ? 'border-green-300 bg-green-50' :
                    job.status === 'failed' ? 'border-red-300 bg-red-50' :
                    'border-yellow-300 bg-yellow-50'
                  }`}>
                    <div className="flex justify-between items-center p-4 border-b border-gray-200">
                      <h3 className="text-lg font-medium">Job: {job.id.substr(0, 8)}...</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        job.status === 'completed' ? 'bg-green-100 text-green-800' :
                        job.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {job.status || 'pending'}
                      </span>
                    </div>
                    
                    <div className="p-4 bg-white">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">Model</p>
                          <p className="font-medium">{job.model.split('/').pop()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Dataset</p>
                          <p className="font-medium">{job.file}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Started</p>
                          <p className="font-medium">{job.startTime}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Logs:</h4>
                        <div className="bg-gray-800 text-gray-200 p-3 rounded-md text-sm font-mono h-32 overflow-y-auto">
                          {jobLogs[job.id]?.map((log, index) => (
                            <div key={index} className="mb-1">
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {jobResults[job.id] && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Results:</h4>
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-gray-500">Training Time</p>
                                <p className="font-medium">{jobResults[job.id].training_time}</p>
                              </div>
                              
                              {jobResults[job.id].evaluation_metrics && (
                                <div>
                                  <p className="font-medium">{jobResults[job.id].evaluation_metrics.loss}</p>
                                </div>
                              )}
                              
                              {jobResults[job.id].model_url && (
                                <div className="md:col-span-2">
                                  <p className="text-sm text-gray-500">Model URL</p>
                                  <a 
                                    href={jobResults[job.id].model_url} 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-medium"
                                  >
                                    {jobResults[job.id].model_url}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      <footer className="mt-auto py-6 bg-gray-100">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} Language Model Fine-Tuning Platform. All rights reserved.</p>
          <p className="mt-2">Powered by React and HuggingFace Transformers</p>
        </div>
      </footer>
    </div>
  );
}

export default App;