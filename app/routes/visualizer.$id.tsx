import {useEffect, useState} from "react";
import {useLocation} from "react-router";
import type {Route} from "./+types/visualizer.$id";
import {getProject} from "../../lib/puter.action";


const VisualizerId = ({params}: Route.ComponentProps) => {
    const location = useLocation();
    const navigationState = location.state as VisualizerLocationState | null;
    const [project, setProject] = useState<DesignItem | null>(null);

    useEffect(() => {
        if (navigationState) return;

        getProject(params.id).then(setProject);
    }, [navigationState, params.id]);

    const initialImage = navigationState?.initialImage ?? project?.sourceImage;
    const name = navigationState?.name ?? project?.name;

    return (
        <section>
            <h1>{name || 'Untitled project'}</h1>

            <div className="image-container">
                <h2>Source Image</h2>
                <img src={initialImage} alt="source"/>
            </div>
        </section>
    )
}
export default VisualizerId
