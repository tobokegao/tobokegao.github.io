import { Composition } from "remotion";
import { Clip, clipMetadata } from "./Clip";

// 1 場面 1 本。render.mjs が id を渡して 1 本ずつ書き出す。長さは素材から決まる
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Clip" component={Clip} calculateMetadata={clipMetadata} durationInFrames={1} fps={30} width={1280} height={720} defaultProps={{ id: "top" }} />
    {/* 縦 9:16（リール・ショート向け）。素材は Clip と同じ録画 */}
    <Composition id="ClipTall" component={Clip} calculateMetadata={clipMetadata} durationInFrames={1} fps={30} width={1080} height={1920} defaultProps={{ id: "top" }} />
  </>
);
