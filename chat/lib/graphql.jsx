

export async function queryGraphQL(query,variables){
	let res=await fetch('/admin/api',{
		method:'POST',
		headers:{
			'Content-Type':'application/json'
		},
		body:JSON.stringify({
			query:query,
			variables:variables
		})
	});

	return res.json();
}