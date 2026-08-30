import { useLocation, useParams } from "react-router";
import { createProject, getProjectById } from "../../lib/puter.action";

const VisualizerId = () => {
  const location = useLocation();
  const { id } = useParams();
  const state = location.state as {
    initialImage?: string;
    initialRendered?: string | null;
    name?: string | null;
  } | null;
  const initialImage = state?.initialImage ?? null;
  const name = state?.name ?? null;
  const resolvedProject = id ? getProjectById(id) : null;
  const projectName = name ?? resolvedProject?.name ?? "Untitled project";
  const projectImage = initialImage ?? resolvedProject?.sourceImage ?? null;

  return (
    <section>
      <h1>{projectName}</h1>

      <div className="image-container">
        <h2>Source Image</h2>
        <img src={projectImage || undefined} alt="source" />
      </div>
    </section>
  );
};
export default VisualizerId;
