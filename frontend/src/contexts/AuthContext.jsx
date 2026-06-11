import axios from "axios";
import httpStatus from "http-status";
import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import server from "../environment";


export const AuthContext = createContext({});

const client = axios.create({
    baseURL: `${server}/api/v1/users`
})

client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "/auth";
        }
        return Promise.reject(error);
    }
);


export const AuthProvider = ({ children }) => {

    const authContext = useContext(AuthContext);


    const [userData, setUserData] = useState(authContext);


    const router = useNavigate();

    const handleRegister = async (name, username, password) => {
        try {
            let request = await client.post("/register", {
                name: name,
                username: username,
                password: password
            })


            if (request.status === httpStatus.CREATED) {
                return request.data.message;
            }
        } catch (err) {
            throw err;
        }
    }

    const handleLogin = async (username, password) => {
        try {
            let request = await client.post("/login", {
                username: username,
                password: password
            });

            console.log(username, password)
            console.log(request.data)

            if (request.status === httpStatus.OK) {
                localStorage.setItem("token", request.data.token);
                router("/home")
            }
        } catch (err) {
            throw err;
        }
    }

    const getHistoryOfUser = async () => {
        const token = localStorage.getItem("token");
        if (!token) return [];
        try {
            let request = await client.get("/get_all_activity", {
                params: { token }
            });
            if (request.status === 200 && Array.isArray(request.data)) {
                return request.data;
            }
            return [];
        } catch (err) {
            console.error("Failed to load user activity history:", err);
            return [];
        }
    }

    const addToUserHistory = async (meetingCode) => {
        const token = localStorage.getItem("token");
        if (!token) return;
        try {
            let request = await client.post("/add_to_activity", {
                token: token,
                meeting_code: meetingCode
            });
            return request;
        } catch (e) {
            console.error("Failed to add meeting code to user history:", e);
        }
    }


    const data = {
        userData, setUserData, addToUserHistory, getHistoryOfUser, handleRegister, handleLogin
    }

    return (
        <AuthContext.Provider value={data}>
            {children}
        </AuthContext.Provider>
    )

}
