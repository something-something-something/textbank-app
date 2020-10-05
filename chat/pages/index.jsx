import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';

import {queryGraphQL} from '../lib/graphql'
const DynamicNavMenu=dynamic(()=>{
	return  import('../components/NavMenu')
},{ssr:false});

function ScriptListPage(){
	return <div>
		Scripts
		<ScriptList/>
	</div>
}
function ScriptList(){
	const [scripts,setScripts]=useState([]);

	const fetchData=async ()=>{

		let res=await queryGraphQL(`
			query{
				authenticatedUser{
					id
					email
				}
				allScripts{
					id
					name
				}
			}
		`,{});
		if(res.data.authenticatedUser===null){
			window.location.pathname='/login';
		}
		else{
			setScripts(res.data.allScripts)
		}
		
	}

	useEffect(()=>{
		fetchData();
	},[])

	return (<div>
		<DynamicNavMenu/>
		<ul>
			{scripts.map((s)=>{
				return <li key={s.id}> <a href={'/chat?script='+encodeURIComponent(s.id)}>{s.name}</a></li>
			})}
		</ul></div>);
}



export default ScriptListPage;