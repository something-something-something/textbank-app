import {useEffect,useState} from 'react';
import {useRouter} from 'next/router';
import {queryGraphQL} from '../lib/graphql';


export function Profile(props){
	const [user,setUser]=useState(null);
	const [nickName,setNickName]=useState('');
	const router=useRouter();
	const fetchData=async ()=>{

		let res=await queryGraphQL(`
			query{
				authenticatedUser{
					id
					role
					email
					nickName
				}
			}
		`,{});

		if(res.data.authenticatedUser===null){

			router.push('/')
		}
		else{
			setUser(res.data.authenticatedUser);
			setNickName(res.data.authenticatedUser.nickName)
		}
	}

	const updateNickName=async ()=>{
		await queryGraphQL(`
			mutation($uid:ID!,$nick:String!){
				updateUser(id:$uid,data:{
					nickName:$nick
				}){
					id
				}
			}
		`,{
			uid:user.id,
			nick:nickName
		});
		fetchData();
	}


	useEffect(()=>{
		fetchData();
	},[]);
	return (<>
	{user!==null&&(
		<div>
			email:{user.email}<br/>
			Nickname:<input value={nickName} onChange={(ev)=>{setNickName(ev.target.value)}}/>
			{user.nickName!==nickName&&(<button onClick={updateNickName}>Save New Nickname</button>)}
			
		</div>
	)}
	
	</>);
}