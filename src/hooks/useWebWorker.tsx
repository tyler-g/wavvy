/*
  useWebWorker
  a custom hook for dynamically calling a Fn inside a Worker context
  useCallback ensures rerenders don't occur unless necessary
*/
import { useState, useEffect, useCallback } from 'react';

const useWebWorker = (workerFn, inputData) => {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const cachedWorkerFn = useCallback(workerFn, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    let workerScriptUrl: string;
    let worker: Worker;

    try {
      const code = cachedWorkerFn.toString();
      const blob = new Blob([`(${code})()`], {
        type: 'application/javascript',
      });
      workerScriptUrl = URL.createObjectURL(blob);
      worker = new Worker(workerScriptUrl);

      worker.postMessage(inputData);
      worker.onmessage = (e) => {
        setResult(e.data);
        setLoading(true);
      };

      worker.onerror = (e) => {
        setError(e.message);
        setLoading(false);
      };
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }

    return () => {
      // cleanup
      worker.terminate();
      URL.revokeObjectURL(workerScriptUrl);
    };
  }, [inputData, cachedWorkerFn]);

  return { result, error, loading };
};

export default useWebWorker;
