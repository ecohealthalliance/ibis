export default new Promise((resolve, reject)=>{
  HTTP.get('/api/locationGeoJson', (err, resp) => {
    if(err) return reject(err);
    resolve(resp.data)
  });
});
