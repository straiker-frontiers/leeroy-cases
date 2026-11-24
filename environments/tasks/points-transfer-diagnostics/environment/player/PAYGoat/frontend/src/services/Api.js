import axios from 'axios';

const api = axios.create({
  baseURL: 'http://paygoat:3000',
});


export default api;