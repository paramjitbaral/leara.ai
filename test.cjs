const axios = require('axios');
axios.post('http://localhost:3000/api/github/import', {
    userId: 'MbskBJHWIhgrr5zEpykxowL4r1n2',
    repoUrl: 'https://github.com/facebook/react.git'
}).then(res => {
    console.log('Success:', res.data.success, 'Num files:', res.data.fileTree?.length);
}).catch(e => {
    console.error('Error:', e.response ? e.response.data : e.message);
});
