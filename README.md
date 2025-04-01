# Language Model Fine-Tuning Platform

A web-based platform for uploading datasets, fine-tuning language models, and querying them with a user-friendly interface.

![Platform Screenshot](https://via.placeholder.com/800x450)

## Features

- **Model Selection**: Choose from a variety of pre-trained language models
- **Dataset Management**: Upload and manage training datasets
- **Fine-Tuning Configuration**: Customize training parameters like epochs, batch size, and learning rate
- **Job Monitoring**: Track fine-tuning jobs with real-time logs and results
- **Model Querying**: Test your fine-tuned models with a simple interface
- **Parameter Control**: Adjust generation parameters such as max length, temperature, top-p, and top-k
- **HuggingFace Integration**: Optionally push fine-tuned models to the HuggingFace Hub

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Python 3.8+ (for the backend)
- FastAPI (for the backend API)

### Installation

#### Frontend

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/language-model-finetuning-platform.git
   cd language-model-finetuning-platform
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

#### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the backend server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

## Usage

### Fine-Tuning a Model

1. **Select a Base Model**: Choose from the available models in the dropdown menu.
2. **Upload Dataset**: Upload your training dataset in CSV, JSON, or TXT format.
3. **Configure Training Parameters**: Set epochs, batch size, learning rate, and other parameters.
4. **Start Fine-Tuning**: Click the "Start Fine-Tuning" button to begin the process.
5. **Monitor Progress**: View real-time logs and results in the "Active Jobs" tab.

### Querying a Model

1. **Select a Model**: Choose a fine-tuned model from the dropdown.
2. **Enter Your Query**: Type your input text in the query field.
3. **Adjust Generation Parameters**: Set max length, temperature, top-p, and top-k as needed.
4. **Generate Response**: Click the "Generate Response" button to get model output.

## Project Structure

```
language-model-finetuning-platform/
├── public/
├── src/
│   ├── App.js           # Main React component
│   ├── index.js         # React entry point
│   ├── components/      # React components
│   └── utils/           # Utility functions
├── backend/
│   ├── main.py          # FastAPI application
│   ├── models/          # Model definitions
│   ├── routes/          # API routes
│   └── utils/           # Utility functions
└── README.md            # Project documentation
```

## API Reference

### Base URL

```
http://localhost:8000
```

### Endpoints

- `GET /models`: Fetch available models
- `POST /upload`: Upload a dataset file
- `POST /finetune`: Start a fine-tuning job
- `GET /jobs/{job_id}`: Get job status, logs, and results
- `POST /query`: Query a fine-tuned model

## Customization

### Changing API Base URL

To connect to a different backend URL, modify the `API_BASE_URL` constant in `src/App.js`:

```javascript
const API_BASE_URL = 'http://your-backend-url:port';
```

### Adding New Features

The modular structure makes it easy to extend the platform with new features:

1. Add new state variables and functions in `App.js`
2. Create new components in the `components` directory
3. Add new API endpoints in the backend

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [React](https://reactjs.org/) - Frontend framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Axios](https://axios-http.com/) - HTTP client
- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [Hugging Face Transformers](https://huggingface.co/transformers/) - For language models
