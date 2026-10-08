import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App.tsx';
import Demo from './pages/Demo.tsx';
import Demo02 from './pages/Demo02.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/demo" element={<Demo />} />
                <Route path="/demo02" element={<Demo02 />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>,
)
