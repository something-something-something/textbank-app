import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';

import {queryGraphQL} from '../lib/graphql'

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
				allScripts{
					id
					name
				}
			}
		`,{});
		setScripts(res.data.allScripts)
	}

	useEffect(()=>{
		fetchData();
	},[])

	return (<ul>
			{scripts.map((s)=>{
				return <li key={s.id}> <a href={'/chat?script='+encodeURIComponent(s.id)}>{s.name}</a></li>
			})}
		</ul>);
}



export default ScriptListPage;