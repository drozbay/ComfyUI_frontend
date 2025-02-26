<template>
  <div
    class="h-[85vh] w-[80vw] mx-auto flex flex-col"
    aria-labelledby="node-search-title"
  >
    <header class="flex flex-col mb-4 px-7">
      <h2 id="node-search-title" class="text-4xl mb-0">{{ title }}</h2>
    </header>

    <Divider
      class="m-0 [&::before]:border-surface-border/70 [&::before]:border-t-2"
    />

    <div class="relative w-full px-7 pb-0 mb-0 pt-10">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="searchQuery"
          placeholder="Search"
          class="w-5/12 rounded-xl"
        />
      </IconField>
      <small
        v-if="searchQuery.trim() && allNodes.length"
        class="text-gray-500 mt-1 block"
      >
        Found {{ allNodes.length }} results
      </small>
    </div>

    <!-- sort dropdown -->
    <div class="px-6 pt-0 mt-0 flex items-center gap-2 w-min">
      <Dropdown
        v-model="sort"
        :options="sortOptions"
        optionLabel=""
        class="w-full"
        :pt="{
          root: 'border-none'
        }"
      />
    </div>

    <ScrollPanel class="h-0 flex-1 max-w-full px-6 pt-6">
      <VirtualGrid
        v-if="allNodes.length"
        :items="allNodes"
        :defaultItemSize="CARD_SIZE"
        class="p-0 m-0 max-w-full"
        :buffer-rows="4"
        :gridStyle="{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_SIZE}px, 1fr))`,
          padding: '0.5rem',
          gap: '0.75rem',
          justifyContent: 'stretch'
        }"
      >
        <template #item="{ item }">
          <div class="relative w-full aspect-square">
            <Card
              class="absolute inset-0 flex flex-col overflow-hidden rounded-2xl cursor-pointer shadow-[0_0_15px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.08),0_4px_6px_-4px_rgba(0,0,0,0.05)] [&_.p-card-body]:p-0 [&_.p-card-content]:rounded-2xl [&_.p-card-body]:rounded-2xl [&_.p-card-body]:flex [&_.p-card-body]:flex-col [&_.p-card-body]:h-full [&_.p-card-content]:flex-1 [&_.p-card-content]:flex [&_.p-card-content]:flex-col"
              :pt="{
                body: 'p-0 flex flex-col h-full',
                content: 'flex-1 flex flex-col'
              }"
            >
              <template #title>
                <div class="flex justify-between p-5 text-muted text-xs">
                  <span class="text-lg">
                    <i class="pi pi-box"></i>
                    Custom Node
                  </span>
                  <div class="flex items-center gap-2 text-muted text-xs">
                    <i class="pi pi-download"></i>
                    {{ item.item.total_install?.toLocaleString() ?? 'N/A' }}
                  </div>
                </div>
              </template>
              <template #content>
                <ContentDivider />
                <div class="flex flex-col flex-1 p-5">
                  <span
                    class="text-lg font-bold pb-4 truncate overflow-hidden text-ellipsis"
                    >{{ item.node }}</span
                  >
                  <div class="flex flex-col gap-3 flex-1">
                    <p
                      v-if="item.item.description"
                      class="text-sm text-color-secondary m-0 line-clamp-3"
                    >
                      {{ item.item.description }}
                    </p>
                  </div>
                </div>
              </template>
              <template #footer>
                <ContentDivider />
                <div class="flex justify-between p-5 text-muted text-xs">
                  <div class="flex items-center gap-2">
                    <span>
                      {{ item.item.publisher_id }}
                    </span>
                    <span>
                      {{ item.item.latest_version }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    Updated
                    {{ new Date(item.item.update_time).toLocaleDateString() }}
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </template>
      </VirtualGrid>
      <div v-if="isSearching" class="flex justify-center">
        <ProgressSpinner class="w-8 h-8" strokeWidth="4" />
      </div>
      <div v-else-if="!allNodes.length" class="text-center p-4">
        <p class="text-lg text-color-secondary">
          No nodes found matching your search.
        </p>
      </div>
    </ScrollPanel>
  </div>
</template>

<script setup lang="ts">
import { liteClient as algoliasearch } from 'algoliasearch/dist/lite/builds/browser'
import Fuse from 'fuse.js'
import { debounce } from 'lodash'
import Card from 'primevue/card'
import Divider from 'primevue/divider'
import Dropdown from 'primevue/dropdown'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import ScrollPanel from 'primevue/scrollpanel'
import { ref, watch } from 'vue'

import VirtualGrid from '@/components/common/VirtualGrid.vue'
import ContentDivider from '@/components/common/divider/ContentDivider.vue'
import type { NodeResults } from '@/types/registryTypes'

declare const __ALGOLIA_APP_ID__: string
declare const __ALGOLIA_API_KEY__: string

const CARD_SIZE = 462

const INDEX_NAME = 'nodes_index'
const DEBOUNCE_TIME = 256
const RETRIEVE_ATTRIBUTES = new Set([
  'comfy_nodes',
  'name',
  'description',
  'latest_version',
  'status',
  'publisher_id',
  'total_install',
  'update_time'
])

const HITS_PER_PAGE = 4

defineProps<{
  title: string
  subtitle?: string
}>()

const sort = ref('relevance')
const sortOptions = ref(['relevance', 'popularity', 'alphabetical'])
const searchQuery = ref('')
const isSearching = ref(false)
const allNodes = ref<NodeResults[]>([])
const searchClient = algoliasearch(__ALGOLIA_APP_ID__, __ALGOLIA_API_KEY__)
// Fuse instance for client-side fuzzy searching
let fuseInstance: Fuse<NodeResults> | null = null

// Configure Fuse.js options
const fuseOptions = {
  keys: [
    { name: 'node', weight: 2 }, // Node name is most important
    { name: 'item.name', weight: 1 } // Package name is secondary
  ],
  includeScore: true,
  threshold: 0.3, // Balanced threshold for fuzzy matching
  distance: 100, // Standard distance for fuzzy matching
  ignoreLocation: true, // Ignore location for better partial matches
  minMatchCharLength: 1, // Match from the first character
  shouldSort: true, // Sort results by score
  findAllMatches: true, // Continue searching after first match
  tokenize: true, // Tokenize the search string and query
  matchAllTokens: false, // Match any token for better partial matches
  isCaseSensitive: false // Case insensitive search
}

const performSearch = async (query: string) => {
  try {
    isSearching.value = true

    const searchParams = {
      query: query,
      // attributesToSnippet: ['description:10'],
      // disableExactOnAttributes: ['description'],
      // distinct: true,
      // enableReRanking,
      // enableRules: true,
      // facetFilters: ['status:stable'],
      length: 4,
      // mode:'neuralSearch',
      numericFilters: ['total_install>0'],
      // offset: 0,
      page: 0,
      // queryType: 'prefixLast',
      hitsPerPage: HITS_PER_PAGE,
      // similarQuery: query,
      // sumOrFiltersScores: true,
      // tagFilters: ['status:stable'],
      attributesToRetrieve: Array.from(RETRIEVE_ATTRIBUTES)
    }

    const { results } = await searchClient.search([
      {
        indexName: INDEX_NAME,
        params: searchParams
      }
    ])

    const nodes: NodeResults[] = []
    const firstResult = results[0] as any

    if (firstResult?.hits?.length) {
      firstResult.hits.forEach((item) => {
        if (!item?.comfy_nodes) return
        const nodeList = Array.isArray(item.comfy_nodes)
          ? item.comfy_nodes
          : [item.comfy_nodes]

        // Process all nodes from the package
        nodeList.forEach((node) => {
          if (node && typeof node === 'string') {
            nodes.push({
              node,
              item,
              key: `${item.name}-${node}`
            })
          }
        })
      })
    }

    // Apply fuzzy search if there's a query
    if (query.trim()) {
      // Initialize Fuse.js with the nodes from Algolia
      fuseInstance = new Fuse(nodes, fuseOptions)

      // Apply fuzzy search to the nodes
      const results = fuseInstance.search(query.trim())
      allNodes.value = results.map((result) => result.item)
    } else {
      // If no query, just show all nodes
      allNodes.value = nodes
    }
  } catch (error) {
    console.error('Search failed:', error)
    allNodes.value = []
  } finally {
    isSearching.value = false
  }
}

const debouncedSearch = debounce(performSearch, DEBOUNCE_TIME)

// Watch for changes in searchQuery and perform a new search
watch(searchQuery, (newQuery) => {
  debouncedSearch(newQuery)
})

// Initial search - will show popular nodes without filtering
performSearch('')
</script>
