import React from 'react'
import {Box} from "lucide-react";
import {Button} from "./ui/Button";

const Navbar = () => {
    const isSignedIn = false;
    const username = 'Hari'
    const handleAuthClick = async () => {

    }
    return (
        <header className="navbar">
            <nav className="inner">
                <div className="left">
                    <div className="brand">
                        <Box className="logo"/>
                        <span className="name">
                            Roomify
                        </span>
                    </div>
                    <ul className="links">
                        <a href="#">Product</a>
                        <a href="#">Pricing</a>
                        <a href="#">Community</a>
                        <a href="#">Enterprise</a>
                    </ul>
                </div>
                <div className="actions">
                    {isSignedIn ? (
                        <>
                    <span className="greeting">
                        {username ? `Hi, ${username}` : 'Signed in'}
                    </span>
                            <Button  onClick={handleAuthClick}  size="sm" className="btn">
                                Logout
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button onClick={handleAuthClick} size="sm" variant="ghost">
                                Log In
                            </Button>


                            <a href="#upload" className="cta">Get Started</a>
                        </>
                    )}
                </div>
            </nav>
        </header>
    )
}
export default Navbar
