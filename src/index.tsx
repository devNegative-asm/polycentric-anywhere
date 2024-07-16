
import * as React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

//@ts-ignore
if(!window.POLYCENTRIC_ANYWHERE_IMPORT_GUARD) {
  //@ts-ignore
  window.POLYCENTRIC_ANYWHERE_IMPORT_GUARD = true
  const container = document.createElement("span")
  document.querySelector("body")?.appendChild(container)
  const root = ReactDOM.createRoot(  
    container
  );
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}