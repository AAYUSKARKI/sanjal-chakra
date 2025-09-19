import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// api for login
export const login = async (email, password) => {
  try {
    const response = await API.post("auth/login", { email, password });
    return response.data; // JSON response from backend
  } catch (error) {
   const errorMessage = error.response?.data || error.message;
    console.error("Login failed:", errorMessage);
    throw errorMessage;
  }
};

//api for signup
export const signup = async (fullname, email, password) => {
    try {
        const response = await API.post("auth/ register", { fullname, email, password })
        return response.data;
    } catch (error) {
        const errorMessage = error.response?.data || error.message;
    console.error("Signup failed:", errorMessage);
    throw errorMessage;
    }
}









//To create the post

export const createPost = async (formData) => {
  try {
    console.log("yasama aayo");
    const response = await API.post("/post/createpost", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    
    return response.data;
  } catch (error) {
    console.error("Error creating post:", error);
    throw error;
  }
};

// To create story
export const createStory = async (text, image) => {
  try {
    const response = await API.post("/story/", { text, image }, {
      withCredentials: true
    });

    return response.data;
  } catch (error) {
    console.error("Error creating story:", error);
    throw error;
  }
};

///--------------------------API for feeed of the------------------

//get story on the home page

export const getAllStory = async () => {
  try {
    const response = await API.get("/story/getStory");
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data || error.message;
    console.error("Failed to fetch story:", errorMessage);
    throw errorMessage;
  }
};

//API for get all post

export const getAllPost = async () => {
  try {
    const response = await API.get("/post/getAllPost");
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data || error.message;
    console.error("Failed to fetch posts:", errorMessage);
    throw errorMessage;
  }
};

//API to message

export const chat = async (text, image) => {
  try {
    const response = await API.post("/message/sendMessage", { text, image });
  } catch (error) {
    const errorMessage = error.response?.data || error.message;
    console.error("Failed to message:", errorMessage);
    throw errorMessage;
  }
};

export default API;
