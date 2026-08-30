import {useLocation} from "react-router";


const VisualizerId = () => {
    const location = useLocation();
    const {initialImage,name} = location.state || {};

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
