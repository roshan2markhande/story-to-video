import React, { useEffect, useState } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const API_BASE = "http://localhost:8080"; // your backend
const API_PREFIX = "/api";

export default function App() {
  const [text, setText] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [autoUpload, setAutoUpload] = useState(false);
  const [singleUrl, setSingleUrl] = useState("");
  const [jobs, setJobs] = useState([]);
  const [queue, setQueue] = useState([]);

  // Poll backend queue every 8s
  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}${API_PREFIX}/instagram/queue`);
        if (data?.ok) setQueue(data.queue || []);
      } catch (err) {}
    };
    fetchQueue();
    const timer = setInterval(fetchQueue, 8000);
    return () => clearInterval(timer);
  }, []);

  const extractText = async () => {
    if (pdfFile) {
      const form = new FormData();
      form.append("file", pdfFile);
      const { data } = await axios.post(`${API_BASE}${API_PREFIX}/extract`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.text || "";
    }
    return text.trim();
  };

  const generateSingle = async () => {
    setLoading(true);
    setSingleUrl("");
    try {
      const base = await extractText();
      if (!base) return alert("Paste text or upload PDF first.");
      const caption = base.slice(0, 120);
      const { data } = await axios.post(`${API_BASE}${API_PREFIX}/video/generate/single`, { caption });
      if (data?.ok && data.file) {
        const url = `${API_BASE}${data.file}`;
        setSingleUrl(url);
        setJobs((j) => [{ kind: "single", path: data.file, status: "queued", caption }, ...j]);

        if (autoUpload)
          await axios.post(`${API_BASE}${API_PREFIX}/instagram/upload`, { videoUrl: data.file, caption });
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateMulti = async () => {
    setLoading(true);
    try {
      const base = await extractText();
      if (!base) return alert("Paste text or upload PDF first.");
      const caption = base.slice(0, 120);
      const { data } = await axios.post(`${API_BASE}${API_PREFIX}/video/generate/multi`, { caption });
      if (data?.ok && Array.isArray(data.files)) {
        const newJobs = data.files.map((f, idx) => ({ idx: idx + 1, path: f, status: "queued", caption }));
        setJobs((j) => [...newJobs, ...j]);

        if (autoUpload) {
          for (let f of data.files) {
            await axios.post(`${API_BASE}${API_PREFIX}/instagram/upload`, { videoUrl: f, caption });
          }
        }
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const manualUpload = async (item) => {
    try {
      setJobs((prev) =>
        prev.map((j) => (j.path === item.path ? { ...j, status: "uploading..." } : j))
      );
      await axios.post(`${API_BASE}${API_PREFIX}/instagram/upload`, {
        videoUrl: item.path,
        caption: item.caption || "",
      });
      setJobs((prev) => prev.map((j) => (j.path === item.path ? { ...j, status: "uploaded" } : j)));
    } catch (err) {
      setJobs((prev) => prev.map((j) => (j.path === item.path ? { ...j, status: "upload failed" } : j)));
    }
  };

  const previewUrl = (p) => (p?.startsWith("http") ? p : `${API_BASE}${p}`);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6">
      <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl p-8 space-y-6">
        <h1 className="text-3xl font-bold text-center text-indigo-700">📽️ Story2Video Dashboard</h1>
        <p className="text-center text-gray-500 mb-6">
          Convert your story text or PDF into auto-uploaded Instagram videos
        </p>

        {/* Input Section */}
        <div className="space-y-4">
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-indigo-500"
            placeholder="Paste your story text here..."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Upload PDF</label>
              <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-600">Schedule Start</label>
              <DatePicker selected={date} onChange={(d) => setDate(d)} className="w-full p-2 border rounded-lg" />
            </div>

            <div className="flex items-center gap-2 mt-6">
              <input id="autoupload" type="checkbox" checked={autoUpload} onChange={(e) => setAutoUpload(e.target.checked)} />
              <label htmlFor="autoupload" className="text-sm text-gray-600">Auto-upload</label>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-4 justify-center">
          <button disabled={loading} onClick={generateSingle} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl shadow-md">
            {loading ? "Processing..." : "Generate Single Video"}
          </button>
          <button disabled={loading} onClick={generateMulti} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl shadow-md">
            {loading ? "Processing..." : "Generate Multi Chunks"}
          </button>
          <button
            onClick={async () => {
              const { data } = await axios.get(`${API_BASE}${API_PREFIX}/instagram/queue`);
              if (data?.ok) setQueue(data.queue || []);
            }}
            className="bg-gray-600 hover:bg-gray-700 text-white px-5 py-2 rounded-xl shadow-md"
          >
            Refresh Queue
          </button>
    <button
  onClick={async () => {
    try {
      const response = await axios.post("/api/repost-top-reels");
      console.log("Reels reposted:", response.data.posted);
    } catch (error) {
      console.error("Error reposting reels:", error);
    }
  }}
>
  Repost Top 10 Reels
</button>
        </div>

        {/* Single Preview */}
        {singleUrl && (
          <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-gray-700">Preview Generated Video</h3>
            <video src={singleUrl} controls className="w-full max-h-80 rounded-xl shadow" />
            <div className="flex gap-3">
              <a href={singleUrl} download className="bg-gray-800 hover:bg-black text-white px-3 py-1 rounded-lg">Download</a>
              <button onClick={() => manualUpload({ path: singleUrl.replace(API_BASE, ""), caption: text.slice(0, 120) })} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg">Upload</button>
            </div>
          </div>
        )}

        {/* Jobs */}
        {jobs.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-4">
            <h3 className="font-semibold mb-3">Generated Jobs</h3>
            <table className="w-full text-sm border rounded-xl overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Path</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Preview</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{idx + 1}</td>
                    <td className="p-2 break-words">{j.path}</td>
                    <td className="p-2">{j.status}</td>
                    <td className="p-2">{j.path && <a href={previewUrl(j.path)} target="_blank" rel="noreferrer" className="text-indigo-600 underline">Open</a>}</td>
                    <td className="p-2"><button onClick={() => manualUpload(j)} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded">Upload</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Server Queue
        <div className="bg-white rounded-xl shadow-md p-4">
          <h3 className="font-semibold mb-2">Server Queue</h3>
          <p className="text-xs text-gray-500 mb-2">Auto-refresh every 8s</p>
          <table className="w-full text-sm border rounded-xl overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2">#</th>
                <th className="p-2">Path</th>
                <th className="p-2">Caption</th>
                <th className="p-2">Status</th>
                <th className="p-2">Preview</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 && (
                <tr><td colSpan={5} className="p-2 text-center text-gray-400">Queue Empty</td></tr>
              )}
              {queue.map((q, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2 break-words">{q.path}</td>
                  <td className="p-2">{q.caption || "-"}</td>
                  <td className="p-2">{q.status || "pending"}</td>
                  <td className="p-2">{q.path && <a href={previewUrl(q.path)} target="_blank" rel="noreferrer" className="text-indigo-600 underline">Open</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> */}
      </div>
    </div>
  );
}
