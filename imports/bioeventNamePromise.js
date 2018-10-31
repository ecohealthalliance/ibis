export default new Promise((resolve, reject)=>{
  HTTP.get('/api/bioeventNames', (err, resp)=>{
    if(err) return reject(err);
    resolve(resp.data);
  });
});
