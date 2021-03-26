// fetch lib as node http methods SUCK `yarn add global node-fetch` etc
const fetch = require('node-fetch')
const fs = require('fs')
const util = require('util')
const process = require('process');
const writeToFile = util.promisify(fs.writeFile)

// x-auth-token - readme.md
const token = process.argv[2];

if (!token) {
  throw new Error('No token provided - read the README.md')
}

const headers = {
  'X-Auth-Token': token,
  'content-type': 'application/json',
  'User-agent': 'Tinder/7.5.3 (iPhone; iOS 10.3.2; Scale/2.00)'
}

const fetchData = async (url, method = 'GET', body) => {
  try {
    console.log('Getting:', url)
    const res = await fetch(`https://api.gotinder.com/${url}`, { method, body, headers })
    const json = await res.json();
    console.log('Response from', `https://api.gotinder.com/${url}`, json)
    return json;
  } catch (e) {
    console.log('Something broke', e)
  }
}

const getMatches = async messageType => {
  const matches = []

  const getMatchesInner = async (token = undefined) => {
    try {
      const tokenFrag = token ? `&page_token=${token}` : ''
      const matchRes = (await fetchData(
        `v2/matches?count=60&is_tinder_u=false&locale=en-GB&message=${messageType}${tokenFrag}`
      )) || { data: { matches: [] } }
      matches.push(...matchRes.data.matches.map(item => item.person._id))
      // if a token is returned, there are more results, loop its self until none left
      const tokenId = matchRes.data.next_page_token
      if (tokenId) {
        await getMatchesInner(tokenId)
      }
    } catch (e) {
      console.log(e)
    }
  }

  await getMatchesInner()
  return matches
}

const getProfile = async id => {
  const data = (await fetchData(`user/${id}?locale=en-GB`)) || { results: {}}
  const { name, distance_mi } = data.results
  console.log(name)
  return { name, distance_mi, id }
}

// fix auth ? idk how to make work
// const auth = async () => {
// const facebook_id = 0
// const facebook_token = ''
// const authData = await fetchData('auth', 'POST', { facebook_token, facebook_id })
// const token = authData.data.token
// }

const chunk = (arr, size = 20) => {
  var myArray = []
  for (var i = 0; i < arr.length; i += size) {
    myArray.push(arr.slice(i, i + size))
  }
  return myArray
}

const run = async () => {
  // await auth()

  const { pos_info } = await fetchData('profile')

  console.log(`Swiping in: ${pos_info.country.name} ${pos_info.city?.name || ''}`)

  // the number here is 1 = matches with messages, 0 = matches with no messages
  const firstMatches = await getMatches(1)
  const secondMatches = await getMatches(0)
  const allUniqeMatches = [...new Set([...firstMatches, ...secondMatches])]
  const chunkProfiles = chunk(allUniqeMatches)
  let userProfiles = []

  console.log(
    `Found ${allUniqeMatches.length} Matches - ${
      allUniqeMatches.length > 100 ? 'You stud' : 'Try harder'
    }`
  )

  for (const idArray of chunkProfiles) {
    const promises = idArray.map(getProfile)
    const profiles = await Promise.all(promises)
    userProfiles.push(...profiles)
    userProfiles = userProfiles.sort((a, b) => a.distance_mi - b.distance_mi)
    await writeToFile(
      `results/${pos_info.country.name}_${pos_info.city?.name || ''}.json`,
      JSON.stringify(userProfiles, null, 4)
    )
  }

  console.log('DONE')
  process.exit()
}

run()
