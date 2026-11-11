import "./App.css";
import { VideoPlayer } from "./components/VideoPlayer/VideoPlayer";
import { playerConfig } from "./config/player.config";

function App() {
  return (
    <main>
      <h1>React Video Player</h1>
      <VideoPlayer config={playerConfig} />
    </main>
  );
}

export default App;
